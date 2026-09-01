import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  agentJobs,
  db,
  flashcards,
  noteImages,
  noteVersions,
  notes,
} from "@/db";
import { addedCharCount } from "@/lib/diff";
import { enqueueAgentJob } from "@/lib/queue";
import { handle } from "@/lib/route";

/** Below this much new prose, a save is a typo fix, not new material. */
const MIN_ADDED_CHARS = 40;

/** Images uploaded since the last save are new material on their own. */
async function countImagesSince(noteId: string, since: Date) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(noteImages)
    .where(and(eq(noteImages.noteId, noteId), gt(noteImages.createdAt, since)));
  return row?.count ?? 0;
}

type Context = { params: Promise<{ id: string }> };

export const GET = handle(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const [note] = await db.select().from(notes).where(eq(notes.id, id));
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [cards, jobs] = await Promise.all([
    db
      .select()
      .from(flashcards)
      .where(eq(flashcards.noteId, id))
      .orderBy(desc(flashcards.createdAt)),
    db
      .select()
      .from(agentJobs)
      .where(eq(agentJobs.noteId, id))
      .orderBy(desc(agentJobs.createdAt))
      .limit(10),
  ]);

  return NextResponse.json({ note, cards, jobs });
});

export const PUT = handle(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { title, body, bodyText } = (await request.json()) as {
    title?: string;
    body?: string;
    bodyText?: string;
  };

  const [current] = await db.select().from(notes).where(eq(notes.id, id));
  if (!current)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const nextTitle = title ?? current.title;
  const nextBody = body ?? current.body;
  const nextText = bodyText ?? current.bodyText;
  const unchanged = nextTitle === current.title && nextBody === current.body;

  if (unchanged) {
    return NextResponse.json({ note: current, job: null, reason: "unchanged" });
  }

  const version = current.version + 1;
  const [note] = await db
    .update(notes)
    .set({
      title: nextTitle,
      body: nextBody,
      bodyText: nextText,
      version,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))
    .returning();

  await db.insert(noteVersions).values({
    noteId: id,
    version,
    title: nextTitle,
    body: nextBody,
    bodyText: nextText,
  });

  // Formatting-only edits change the HTML but not the prose, so the diff runs
  // on the flattened text. Newly pasted images count as new material too.
  const newImages = await countImagesSince(id, current.updatedAt);
  if (
    addedCharCount(current.bodyText, nextText) < MIN_ADDED_CHARS &&
    newImages === 0
  ) {
    return NextResponse.json({ note, job: null, reason: "no-new-material" });
  }

  // One in-flight job per note. `running` counts as in-flight too: two agents
  // on the same note would each call getExistingFlashcards before either
  // saved, so neither would see the other's cards and both would write them.
  const [inFlight] = await db
    .select({ id: agentJobs.id })
    .from(agentJobs)
    .where(
      and(
        eq(agentJobs.noteId, id),
        inArray(agentJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);
  if (inFlight) {
    return NextResponse.json({ note, job: null, reason: "already-queued" });
  }

  const [job] = await db
    .insert(agentJobs)
    .values({ noteId: id, version })
    .returning();
  // Recorded on the job so a stuck one explains itself in the Agent tab,
  // rather than only in the host's function logs.
  const handoff = await enqueueAgentJob(job.id);
  await db
    .update(agentJobs)
    .set({ trigger: handoff.detail })
    .where(eq(agentJobs.id, job.id));

  return NextResponse.json({ note, job, reason: "queued" });
});
