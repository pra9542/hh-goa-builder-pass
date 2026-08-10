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

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {

    const cookies = parseCookies(
      req.headers.cookie || ''
    );

    const accessToken =
      cookies.x_access_token;

    if (!accessToken) {
      return res.status(401).json({
        error: 'X account is not connected',
        loginUrl: '/api/x-login'
      });
    }

    /*
     * Frontend sends:
     *
     * {
     *   imageUrl: "...",
     *   text: "..."
     * }
     */

    const {
      imageUrl,
      text
    } = req.body || {};

    if (!imageUrl) {
      return res.status(400).json({
        error: 'imageUrl is required'
      });
    }

    /*
     * Download Builder Pass PNG
     */

    const imageResponse =
      await fetch(imageUrl);

    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Could not download Builder Pass image'
      });
    }

    const imageBuffer =
      Buffer.from(
        await imageResponse.arrayBuffer()
      );

    /*
     * X media upload
     *
     * The exact media-upload endpoint/authentication
     * depends on the X API access available to your app.
     */

    const mediaForm = new FormData();

    mediaForm.append(
      'media',
      new Blob(
        [imageBuffer],
        { type: 'image/png' }
      ),
      'HH-Goa-2026-Builder-Pass.png'
    );

    const mediaResponse =
      await fetch(
        'https://api.x.com/2/media/upload',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          },
          body: mediaForm
        }
      );

    const mediaData =
      await mediaResponse.json();

    if (!mediaResponse.ok) {

      console.error(
        'X media upload error:',
        mediaData
      );

      return res.status(
        mediaResponse.status
      ).json({
        error:
          mediaData?.detail ||
          mediaData?.title ||
          'X image upload failed',
        details: mediaData
      });
    }

    const mediaId =
      mediaData?.data?.id ||
      mediaData?.id;

    if (!mediaId) {
      return res.status(502).json({
        error:
          'X did not return a media ID',
        details: mediaData
      });
    }

    /*
     * Create X post with image
     */

    const postResponse =
      await fetch(
        'https://api.x.com/2/tweets',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            text:
              text ||
              'I’m building in Goa 🌴 with HH Goa 2026. #FrameInGoa #HHGoa2026',

            media: {
              media_ids: [
                mediaId
              ]
            }
          })
        }
      );

    const postData =
      await postResponse.json();

    if (!postResponse.ok) {

      console.error(
        'X post error:',
        postData
      );

      return res.status(
        postResponse.status
      ).json({
        error:
          postData?.detail ||
          postData?.title ||
          'Could not create X post',
        details: postData
      });
    }

    return res.status(200).json({
      success: true,
      post: postData,
      mediaId
    });

  } catch (error) {

    console.error(
      'X post error:',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'X posting failed'
    });
  }
}