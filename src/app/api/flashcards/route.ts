import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, flashcards, notes } from "@/db";
import { handle } from "@/lib/route";

export const GET = handle(async () => {
  const rows = await db
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
      createdAt: flashcards.createdAt,
      noteId: flashcards.noteId,
      noteTitle: notes.title,
    })
    .from(flashcards)
    .innerJoin(notes, eq(flashcards.noteId, notes.id))
    .orderBy(desc(flashcards.createdAt));

  return NextResponse.json(rows);
});

export const DELETE = handle(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(flashcards).where(eq(flashcards.id, id));
  return new NextResponse(null, { status: 204 });
});
