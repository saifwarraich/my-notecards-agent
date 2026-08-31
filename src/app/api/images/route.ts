import { NextResponse } from "next/server";
import { db, noteImages } from "@/db";
import { handle } from "@/lib/route";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Receives an image pasted or dropped into the editor. */
export const POST = handle(async (request: Request) => {
  const form = await request.formData();
  const noteId = form.get("noteId");
  const file = form.get("file");

  if (typeof noteId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "noteId and file are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is larger than 4MB." },
      { status: 413 },
    );
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const [image] = await db
    .insert(noteImages)
    .values({ noteId, mediaType: file.type, data })
    .returning({ id: noteImages.id });

  return NextResponse.json({ id: image.id, url: `/api/images/${image.id}` });
});
