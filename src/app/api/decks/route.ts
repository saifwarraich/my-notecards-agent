import { desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, flashcards, notes } from "@/db";
import { handle } from "@/lib/route";

/** Decks per page. One deck is one note plus its cards. */
const PAGE_SIZE = 4;
/** Cards loaded per deck. Enough for any realistic note. */
const CARDS_PER_DECK = 100;

/**
 * Review data, paginated by note so the client can load decks as it scrolls.
 * Notes with no cards are skipped — an empty deck is nothing to review.
 */
export const GET = handle(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number(params.get("offset") ?? 0));
  const limit = Math.min(20, Number(params.get("limit") ?? PAGE_SIZE));

  const withCards = db
    .select({ noteId: flashcards.noteId })
    .from(flashcards)
    .where(eq(flashcards.noteId, notes.id));

  const page = await db
    .select({
      id: notes.id,
      title: notes.title,
      updatedAt: notes.updatedAt,
      cardCount: sql<number>`(
        select count(*)::int from "flashcards"
        where "flashcards"."note_id" = "notes"."id"
      )`,
    })
    .from(notes)
    .where(sql`exists ${withCards}`)
    .orderBy(desc(notes.updatedAt))
    .limit(limit + 1) // One extra row tells us whether more pages exist.
    .offset(offset);

  const hasMore = page.length > limit;
  const decks = page.slice(0, limit);

  if (decks.length === 0) {
    return NextResponse.json({ decks: [], hasMore: false });
  }

  const cards = await db
    .select()
    .from(flashcards)
    .where(
      inArray(
        flashcards.noteId,
        decks.map((d) => d.id),
      ),
    )
    .orderBy(desc(flashcards.createdAt))
    .limit(CARDS_PER_DECK * decks.length);

  return NextResponse.json({
    hasMore,
    decks: decks.map((deck) => ({
      ...deck,
      cards: cards.filter((c) => c.noteId === deck.id),
    })),
  });
});
