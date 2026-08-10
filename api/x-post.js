
function parseCookies(cookieHeader = '') {
  const cookies = {};

  cookieHeader.split(';').forEach((part) => {
    const index = part.indexOf('=');

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
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
    // --------------------------------
    // 1. Get OAuth 2.0 access token
    // --------------------------------

    const cookies = parseCookies(
      req.headers.cookie || ''
    );

    const accessToken = cookies.x_access_token;

    if (!accessToken) {
      return res.status(401).json({
        error: 'X account is not connected',
        loginUrl: '/api/x-login'
      });
    }

    // --------------------------------
    // 2. Get image + text
    // --------------------------------

    const {
      imageUrl,
      text
    } = req.body || {};

    if (!imageUrl) {
      return res.status(400).json({
        error: 'imageUrl is required'
      });
    }

    // --------------------------------
    // 3. Download Builder Pass
    // --------------------------------

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Could not download Builder Pass image'
      });
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    console.log(
      'Builder Pass size:',
      imageBuffer.length,
      'bytes'
    );

    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        error:
          'Builder Pass PNG is larger than X 5MB image limit'
      });
    }

    // --------------------------------
    // 4. Convert PNG to base64
    // --------------------------------

    const base64Image =
      imageBuffer.toString('base64');

    // --------------------------------
    // 5. Upload image to X
    // --------------------------------

    console.log('Uploading image to X...');

    const mediaResponse = await fetch(
      'https://api.x.com/2/media/upload',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          media: base64Image,
          media_category: 'tweet_image',
          media_type: 'image/png',
          shared: false
        })
      }
    );

    const mediaText =
      await mediaResponse.text();

    let mediaData;

    try {
      mediaData = JSON.parse(mediaText);
    } catch {
      mediaData = {
        raw: mediaText
      };
    }

    console.log(
      'X media status:',
      mediaResponse.status
    );

    console.log(
      'X media response:',
      mediaData
    );

    if (!mediaResponse.ok) {
      return res.status(
        mediaResponse.status
      ).json({
        error:
          mediaData?.detail ||
          mediaData?.title ||
          'X image upload failed',

        xStatus:
          mediaResponse.status,

        details:
          mediaData
      });
    }

    // --------------------------------
    // 6. Get media ID
    // --------------------------------

    const mediaId =
      mediaData?.data?.id;

    if (!mediaId) {
      return res.status(502).json({
        error:
          'X did not return a media ID',

        details:
          mediaData
      });
    }

    console.log(
      'X media ID:',
      mediaId
    );

    // --------------------------------
    // 7. Create X post
    // --------------------------------

    console.log(
      'Creating X post...'
    );

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

    const postText =
      await postResponse.text();

    let postData;

    try {
      postData =
        JSON.parse(postText);
    } catch {
      postData = {
        raw: postText
      };
    }

    console.log(
      'X post status:',
      postResponse.status
    );

    console.log(
      'X post response:',
      postData
    );

    if (!postResponse.ok) {
      return res.status(
        postResponse.status
      ).json({
        error:
          postData?.detail ||
          postData?.title ||
          'Could not create X post',

        xStatus:
          postResponse.status,

        details:
          postData
      });
    }

    // --------------------------------
    // 8. Success
    // --------------------------------

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

