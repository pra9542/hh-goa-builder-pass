// api/share.js
// Reached via the /share -> /api/share rewrite in vercel.json.
// Renders a minimal HTML page with Open Graph / Twitter Card metadata
// pointing at the Cloudinary image, so X's crawler can pull a real
// link-preview image for the intent tweet. Humans who land here (e.g.
// from the X preview click) see a simple page with the image + a link
// back to the generator.

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAllowedImageUrl(url) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    // Only allow Cloudinary-hosted images from *this* configured cloud,
    // e.g. https://res.cloudinary.com/<cloud_name>/...
    if (u.hostname !== 'res.cloudinary.com') return false;
    if (cloudName && !u.pathname.startsWith(`/${cloudName}/`)) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const rawImg = typeof req.query.img === 'string' ? req.query.img : '';
  const rawName = typeof req.query.name === 'string' ? req.query.name : 'HH Goa Builder';

  const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const name = escapeHtml(rawName.slice(0, 60)) || 'HH Goa Builder';

  if (!isAllowedImageUrl(rawImg)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>HH Goa 2026</title></head>
<body><p>This share link is invalid or has expired. Head back to
<a href="${escapeHtml(baseUrl || '/')}">HH Goa 2026 Builder Pass</a> to make a new one.</p>
</body></html>`);
  }

  const imgUrl = escapeHtml(rawImg);
  const pageUrl = `${baseUrl}/share?img=${encodeURIComponent(rawImg)}&name=${encodeURIComponent(rawName)}`;
  const title = `${name}'s HH Goa 2026 Builder Pass`;
  const description = 'Building in Goa with HH 2026. #FrameInGoa #HHGoa2026';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>

<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imgUrl}">

<style>
  body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:#0a3a2e;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{max-width:640px;text-align:center}
  img{max-width:100%;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
  a{color:#a9d979;font-weight:800;text-decoration:none}
  a:hover{text-decoration:underline}
  p{opacity:.85}
</style>
</head>
<body>
  <div class="card">
    <img src="${imgUrl}" alt="${escapeHtml(title)}">
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(baseUrl || '/')}">Make your own HH Goa 2026 Builder Pass →</a></p>
  </div>
</body>
</html>`);
}
