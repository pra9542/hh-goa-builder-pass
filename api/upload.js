// api/upload.js

import crypto from 'node:crypto';
import Busboy from 'busboy';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg'
]);

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: 1,
        fields: 5
      }
    });

    let fileBuffer = null;
    let fileMime = null;
    let fileTooBig = false;

    const fields = {};

    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'image') {
        stream.resume();
        return;
      }

      fileMime = info.mimeType;

      const chunks = [];

      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      stream.on('limit', () => {
        fileTooBig = true;
      });

      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    busboy.on('finish', () => {
      if (fileTooBig) {
        reject(
          Object.assign(
            new Error('File too large. Maximum size is 10 MB.'),
            { statusCode: 413 }
          )
        );
        return;
      }

      resolve({
        fileBuffer,
        fileMime,
        fields
      });
    });

    req.pipe(busboy);
  });
}


// -----------------------------------------
// Cloudinary signature
// -----------------------------------------

function signCloudinaryParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}


// -----------------------------------------
// Upload PNG/JPEG to Cloudinary
// -----------------------------------------

async function uploadToCloudinary(buffer, mime) {

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME;

  const apiKey =
    process.env.CLOUDINARY_API_KEY;

  const apiSecret =
    process.env.CLOUDINARY_API_SECRET;


  // Check environment variables
  if (!cloudName || !apiKey || !apiSecret) {

    throw Object.assign(
      new Error(
        'Cloudinary environment variables are not configured.'
      ),
      { statusCode: 500 }
    );
  }


  const timestamp =
    Math.floor(Date.now() / 1000);


  const paramsToSign = {
    folder: 'hh-goa-2026',
    timestamp
  };


  const signature =
    signCloudinaryParams(
      paramsToSign,
      apiSecret
    );


  const form = new FormData();


  form.append(
    'file',
    new Blob(
      [buffer],
      { type: mime }
    ),
    'HH-Goa-2026-Builder-Pass.png'
  );


  form.append(
    'api_key',
    apiKey
  );


  form.append(
    'timestamp',
    String(timestamp)
  );


  form.append(
    'folder',
    'hh-goa-2026'
  );


  form.append(
    'signature',
    signature
  );


  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: form
    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    throw Object.assign(
      new Error(
        data?.error?.message ||
        'Cloudinary upload failed'
      ),
      { statusCode: 502 }
    );

  }


  return data;
}


// -----------------------------------------
// Vercel API handler
// -----------------------------------------

export default async function handler(req, res) {

  // Only POST is allowed
  if (req.method !== 'POST') {

    res.setHeader(
      'Allow',
      'POST'
    );

    return res
      .status(405)
      .json({
        error: 'Method not allowed'
      });
  }


  try {

    // Parse uploaded PNG
    const {
      fileBuffer,
      fileMime,
      fields
    } = await parseMultipart(req);


    // Check image
    if (
      !fileBuffer ||
      fileBuffer.length === 0
    ) {

      return res
        .status(400)
        .json({
          error: 'No image uploaded'
        });
    }


    // Check file type
    if (!ALLOWED_MIME.has(fileMime)) {

      return res
        .status(400)
        .json({
          error:
            'Only PNG or JPEG images are supported'
        });
    }


    // Upload to Cloudinary
    const cloudinaryData =
      await uploadToCloudinary(
        fileBuffer,
        fileMime
      );


    // Get public website URL
    const baseUrl =
      (
        process.env.PUBLIC_BASE_URL ||
        ''
      ).replace(/\/+$/, '');


    if (!baseUrl) {

      return res
        .status(500)
        .json({
          error:
            'PUBLIC_BASE_URL is not configured'
        });
    }


    // Builder name
    const name =
      (
        fields.name ||
        'HH Goa Builder'
      ).slice(0, 60);


    // Create public share page
    const shareUrl =
      `${baseUrl}/share?img=` +
      `${encodeURIComponent(
        cloudinaryData.secure_url
      )}` +
      `&name=` +
      `${encodeURIComponent(name)}`;


    // Return URLs to frontend
    return res
      .status(200)
      .json({

        success: true,

        shareUrl,

        imageUrl:
          cloudinaryData.secure_url

      });


  } catch (error) {

    console.error(
      'upload error:',
      error
    );


    const statusCode =
      error.statusCode || 500;


    return res
      .status(statusCode)
      .json({

        error:
          error.message ||
          'Upload failed'

      });
  }
}