import crypto from "node:crypto";

function sha1(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export async function POST(request) {
  try {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud || !key || !secret) {
      return Response.json(
        { error: "Cloudinary environment variables are not configured." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const image = form.get("image");

    if (!image || typeof image.arrayBuffer !== "function") {
      return Response.json({ error: "Missing image." }, { status: 400 });
    }

    const maxBytes = 10 * 1024 * 1024;
    if (image.size > maxBytes) {
      return Response.json(
        { error: "Image is larger than 10MB." },
        { status: 413 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "hh-goa-2026";
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${secret}`;
    const signature = sha1(signatureBase);

    const uploadForm = new FormData();
    const bytes = await image.arrayBuffer();
    const blob = new Blob([bytes], {
      type: image.type || "image/png"
    });

    uploadForm.append("file", blob, "HH-Goa-2026-Builder-Pass.png");
    uploadForm.append("api_key", key);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("folder", folder);
    uploadForm.append("signature", signature);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      { method: "POST", body: uploadForm }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Cloudinary upload failed:", uploadData);
      return Response.json(
        { error: "Image storage upload failed." },
        { status: 502 }
      );
    }

    const imageUrl = uploadData.secure_url;
    const origin = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
    const shareUrl =
      `${origin.replace(/\/$/, "")}/share?image=${encodeURIComponent(imageUrl)}`;

    return Response.json({ imageUrl, shareUrl });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not create share link." },
      { status: 500 }
    );
  }
}
