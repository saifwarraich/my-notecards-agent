import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { agentJobs, db, notes } from "@/db";
import { reapStaleJobs } from "@/agent/run";
import { handle } from "@/lib/route";

export const GET = handle(async () => {
  await reapStaleJobs();

  const rows = await db
    .select({
      id: agentJobs.id,
      status: agentJobs.status,
      model: agentJobs.model,
      steps: agentJobs.steps,
      cardsCreated: agentJobs.cardsCreated,
      error: agentJobs.error,
      createdAt: agentJobs.createdAt,
      finishedAt: agentJobs.finishedAt,
      noteId: agentJobs.noteId,
      noteTitle: notes.title,
    })
    .from(agentJobs)
    .innerJoin(notes, eq(agentJobs.noteId, notes.id))
    .orderBy(desc(agentJobs.createdAt))
    .limit(50);

  return NextResponse.json(rows);
});
