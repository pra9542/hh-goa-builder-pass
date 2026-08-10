import crypto from 'node:crypto';

function parseCookies(cookieHeader = '') {
  const cookies = {};

  cookieHeader.split(';').forEach((part) => {
    const index = part.indexOf('=');

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).send(
        `X authorization failed: ${error_description || error}`
      );
    }

    if (!code) {
      return res.status(400).send(
        'Missing authorization code'
      );
    }

    const cookies = parseCookies(
      req.headers.cookie || ''
    );

    const codeVerifier = cookies.x_code_verifier;

    if (!codeVerifier) {
      return res.status(400).send(
        'X login session expired. Please try again.'
      );
    }

    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;

    const redirectUri =
      process.env.X_REDIRECT_URI ||
      'https://hh-goa-builder-pass.vercel.app/api/x-callback';

    if (!clientId || !clientSecret) {
      return res.status(500).send(
        'X_CLIENT_ID or X_CLIENT_SECRET is not configured.'
      );
    }

    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString('base64');

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    const response = await fetch(
      'https://api.x.com/2/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
          Authorization:
            `Basic ${credentials}`
        },
        body
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('X token error:', data);

      return res.status(500).json({
        error:
          data?.error_description ||
          data?.error ||
          'Could not get X access token'
      });
    }

    /*
     * IMPORTANT:
     * This demo stores the access token in an HttpOnly cookie.
     *
     * For a production application with multiple users,
     * store tokens securely in a database instead.
     */

    const accessToken = data.access_token;

    const refreshToken = data.refresh_token || '';

    res.setHeader(
      'Set-Cookie',
      [
        `x_access_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`,
        refreshToken
          ? `x_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
          : ''
      ]
        .filter(Boolean)
        .join(', ')
    );

    /*
     * Send user back to the Builder Pass.
     */

    return res.redirect(
      302,
      '/?x=connected'
    );

  } catch (error) {
    console.error(
      'X callback error:',
      error
    );

    return res.status(500).send(
      'X authorization failed.'
    );
  }
}