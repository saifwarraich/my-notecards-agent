"use client";

/**
 * Shrinks an image in the browser before it is uploaded.
 *
 * A retina screenshot is a 2-4MB PNG; stored as base64 in Postgres that eats a
 * free-tier database fast, and Neon fails *writes* once the cap is hit — so
 * unbounded images would eventually break note-taking itself. Resized to
 * 1600px and re-encoded as WebP the same image is a few hundred KB, which is
 * also comfortably inside what vision models want to read.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

export async function downscaleImage(file: File): Promise<File> {
  // GIFs are usually animated and a canvas would flatten them to one frame.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Undecodable here; let the server decide what to do with it.
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );

  // Keep the original if the browser cannot encode WebP, or if re-encoding
  // made the file bigger (already-optimised photos sometimes do).
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], `${stripExtension(file.name)}.webp`, {
    type: "image/webp",
  });
}

function stripExtension(name: string) {
  return name.replace(/\.[^./\\]+$/, "") || "image";
}
