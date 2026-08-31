import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, noteImages } from "@/db";
import { handle } from "@/lib/route";

type Context = { params: Promise<{ id: string }> };

/** Serves a stored image. Content is immutable, so it caches hard. */
export const GET = handle(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const [image] = await db
    .select({ mediaType: noteImages.mediaType, data: noteImages.data })
    .from(noteImages)
    .where(eq(noteImages.id, id));

  if (!image) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // A Blob keeps the bytes binary. Handing the Buffer straight to NextResponse
  // gets it stringified as UTF-8, which silently corrupts the image.
  const bytes = Buffer.from(image.data, "base64");
  const blob = new Blob([new Uint8Array(bytes)], { type: image.mediaType });

  return new NextResponse(blob, {
    headers: {
      "Content-Type": image.mediaType,
      "Content-Length": String(blob.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
