function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(request) {
  const url = new URL(request.url);
  const image = url.searchParams.get("image");

  if (!image) {
    return new Response("Missing image.", { status: 400 });
  }

  let imageUrl;
  try {
    imageUrl = decodeURIComponent(image);
    const parsed = new URL(imageUrl);

    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".cloudinary.com")
    ) {
      return new Response("Invalid image host.", { status: 400 });
    }
  } catch {
    return new Response("Invalid image URL.", { status: 400 });
  }

  const safeImage = escapeHtml(imageUrl);
  const title = "HH Goa 2026 Builder Pass";
  const description =
    "HH Goa 2026 Builder Pass — building, connecting and vibing in Goa. #FrameInGoa";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${safeImage}">
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#062d27;color:#fff;display:grid;place-items:center;min-height:100vh}
main{text-align:center;max-width:760px;padding:24px}
img{max-width:100%;height:auto;border-radius:18px;box-shadow:0 20px 60px #0008}
p{opacity:.8}
</style>
</head>
<body>
<main>
<h1>HH Goa 2026 Builder Pass</h1>
<img src="${safeImage}" alt="HH Goa 2026 Builder Pass">
<p>Build. Connect. Vibe. 🌴</p>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300"
    }
  });
}
