import crypto from "node:crypto";

function sha1(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud || !key || !secret) {
      return res.status(500).json({
        error: "Cloudinary environment variables are not configured."
      });
    }

    const form = await req.formData();
    const image = form.get("image");

    if (!image || typeof image.arrayBuffer !== "function") {
      return res.status(400).json({ error: "Missing image." });
    }

    const maxBytes = 10 * 1024 * 1024;
    if (image.size > maxBytes) {
      return res.status(413).json({ error: "Image is larger than 10MB." });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "hh-goa-2026";
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${secret}`;
    const signature = sha1(signatureBase);

    const uploadForm = new FormData();
    uploadForm.append("file", image);
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
      return res.status(502).json({ error: "Image storage upload failed." });
    }

    const imageUrl = uploadData.secure_url;
    const shareUrl =
      `${process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`}` +
      `/share?image=${encodeURIComponent(imageUrl)}`;

    return res.status(200).json({ imageUrl, shareUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create share link." });
  }
}
