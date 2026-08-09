// api/upload.js
// Vercel Node.js Serverless Function (NOT Next.js) — plain @vercel/node runtime.
// Accepts a multipart/form-data POST with an "image" file + "name" field,
// uploads the image to Cloudinary via a *signed* upload (secret never touches
// the browser), and returns a JSON payload with a shareUrl the frontend can
// hand to the X web intent.

import crypto from 'node:crypto';
import Busboy from 'busboy';

// NOTE: this is a plain Vercel Node.js Serverless Function (not Next.js),
// so there's no `config.api.bodyParser` switch to flip. Vercel only
// auto-parses req.body for json/text/urlencoded content types and leaves
// multipart/form-data as a raw stream, which is exactly what we want here
// so we can pipe it straight into busboy below.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, matches the frontend limit
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: 1,
        fields: 5,
      },
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
      stream.on('data', (chunk) => chunks.push(chunk));
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

    busboy.on('error', reject);

    busboy.on('finish', () => {
      if (fileTooBig) {
        reject(Object.assign(new Error('File too large'), { statusCode: 413 }));
        return;
      }
      resolve({ fileBuffer, fileMime, fields });
    });

    req.pipe(busboy);
  });
}

function signCloudinaryParams(params, apiSecret) {
  // Cloudinary signature = sha1(sorted "key=value&key=value..." + api_secret)
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

async function uploadToCloudinary(buffer, mime) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw Object.assign(new Error('Server is not configured'), { statusCode: 500 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: 'hh-goa-2026',
    timestamp,
  };
  const signature = signCloudinaryParams(paramsToSign, apiSecret);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), 'builder-pass.png');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', 'hh-goa-2026');
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.message || 'Cloudinary upload failed'), {
      statusCode: 502,
    });
  }
  return data; // includes secure_url, public_id, etc.
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBuffer, fileMime, fields } = await parseMultipart(req);

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    if (!ALLOWED_MIME.has(fileMime)) {
      return res.status(400).json({ error: 'Only PNG or JPEG images are supported' });
    }

    const cloudinaryData = await uploadToCloudinary(fileBuffer, fileMime);

    const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      return res.status(500).json({ error: 'PUBLIC_BASE_URL is not configured' });
    }

    const name = (fields.name || 'HH Goa Builder').slice(0, 60);
    const shareUrl =
      `${baseUrl}/share?img=${encodeURIComponent(cloudinaryData.secure_url)}` +
      `&name=${encodeURIComponent(name)}`;

    return res.status(200).json({
      shareUrl,
      imageUrl: cloudinaryData.secure_url,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('upload error:', err);
    return res.status(statusCode).json({ error: err.message || 'Upload failed' });
  }
}
