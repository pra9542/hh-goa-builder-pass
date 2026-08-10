import crypto from 'node:crypto';

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const clientId = process.env.X_CLIENT_ID;

  if (!clientId) {
    return res.status(500).send(
      'X_CLIENT_ID is not configured'
    );
  }

  const redirectUri =
    process.env.X_REDIRECT_URI ||
    'https://hh-goa-builder-pass.vercel.app/api/x-callback';

  // PKCE
  const codeVerifier = base64url(
    crypto.randomBytes(32)
  );

  const codeChallenge = base64url(
    crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest()
  );

  // Store verifier temporarily in a signed state.
  const state = base64url(
    crypto.randomBytes(24)
  );

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  // For now, pass the verifier through the state cookie.
  res.setHeader(
    'Set-Cookie',
    `x_code_verifier=${encodeURIComponent(
      codeVerifier
    )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const authorizationUrl =
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  return res.redirect(302, authorizationUrl);
}