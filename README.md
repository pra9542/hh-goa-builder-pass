# HH Goa 2026 Builder Pass — X Share Backend

## What this adds
The browser generates the PNG locally. On **Share on X**, the PNG is uploaded to Cloudinary through `/api/upload`.
The backend returns a `/share?...` page containing `og:image` and `twitter:image` metadata pointing to the generated PNG.
The X intent receives that public share URL, so X can crawl the page and show the generated graphic as a link preview.

## Deploy
1. Create a Cloudinary account and create an API key/secret.
2. Deploy this folder to Vercel.
3. Add these Vercel environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `PUBLIC_BASE_URL` (your final HTTPS Vercel URL)
4. Redeploy.
5. Open the deployed site, upload a photo, fill details, preview, then click **Share on X**.

## Security
Cloudinary API secret stays on the Vercel server. Do NOT put it in `index.html`.
The upload endpoint limits files to 10MB and stores them under `hh-goa-2026`.
The share endpoint only accepts HTTPS Cloudinary image URLs.

## X behavior
Desktop/web: the generated PNG gets a public URL with OG/Twitter image metadata; the X intent includes that URL.
Mobile: the native share sheet is offered with the public preview URL; choose X.
