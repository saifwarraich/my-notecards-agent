import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, notes } from "@/db";
import { handle } from "@/lib/route";

export const GET = handle(async () => {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      updatedAt: notes.updatedAt,
      version: notes.version,
      // Column names are written out qualified: inside the subquery Drizzle
      // renders bare names, and `note_id = id` then compares two columns of
      // `flashcards` to each other, which is never true.
      cardCount: sql<number>`(
        select count(*)::int from "flashcards"
        where "flashcards"."note_id" = "notes"."id"
      )`,
    })
    .from(notes)
    .orderBy(desc(notes.updatedAt));

  return NextResponse.json(rows);
});

export const POST = handle(async () => {
  const [note] = await db.insert(notes).values({}).returning();
  return NextResponse.json(note, { status: 201 });
});

export const DELETE = handle(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(notes).where(eq(notes.id, id));
  return new NextResponse(null, { status: 204 });
});
