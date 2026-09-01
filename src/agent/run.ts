import { generateText, stepCountIs } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { agentJobs, db, type AgentStep } from "@/db";
import { getModel } from "@/lib/model";
import { buildTools } from "./tools";

const SYSTEM_PROMPT = `You are a study assistant that turns a person's own notes into flashcards.

Work like this:
1. Call getNoteDiff to see what changed in this save.
2. Call readNote if you need surrounding context to understand the change.
3. If the diff reports new images, call viewImages on them. Notes often carry the real content in a diagram or screenshot rather than the prose around it.
4. Call getExistingFlashcards so you never repeat a card that already exists.
5. Call saveFlashcards once with the cards worth keeping.

Rules:
- Only make cards for material that is genuinely new in this save.
- A good card tests one idea. Front is a real question, not a topic label.
- Backs are short: a sentence or two, no padding.
- Skip formatting noise, headings, TODOs, and half-finished thoughts.
- For images, make cards about what the image teaches, not about the image itself. "What does the diagram show?" is a bad card; a question about the relationship the diagram depicts is a good one.
- Ignore decorative images that carry no information.
- If the change added nothing worth memorising, call saveFlashcards with an empty array. That is a valid, expected outcome.
- Never produce more than 8 cards in a single run.`;

/** Runs the agent loop for one job and records everything it did. */
export async function runAgentJob(jobId: string) {
  // Claim the job with a single conditional UPDATE. Reading the status and
  // then writing it would let two deliveries of the same job — a QStash retry
  // landing on a run that is still alive, or two serverless instances — both
  // pass the check and both run the agent, duplicating cards and spend.
  // Whoever loses the race gets no row back.
  const [job] = await db
    .update(agentJobs)
    .set({ status: "running" })
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.status, "pending")))
    .returning();

  if (!job) {
    const [existing] = await db
      .select({ status: agentJobs.status })
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));
    if (!existing) throw new Error(`job ${jobId} not found`);
    return { skipped: true, status: existing.status };
  }

  try {
    const { model, label } = getModel();
    await db
      .update(agentJobs)
      .set({ model: label })
      .where(eq(agentJobs.id, jobId));

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt:
        "The note was just saved. Review what changed and create flashcards for the new material.",
      tools: buildTools({ noteId: job.noteId, jobId }),
      stopWhen: stepCountIs(8),
    });

    const steps: AgentStep[] = [];
    let cardsCreated = 0;
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        const output = step.toolResults.find(
          (r) => r.toolCallId === call.toolCallId,
        )?.output;
        steps.push({
          tool: call.toolName,
          input: call.input,
          output: stripBlobs(output),
        });
        if (call.toolName === "saveFlashcards") {
          cardsCreated += (output as { saved?: number })?.saved ?? 0;
        }
      }
    }

    await db
      .update(agentJobs)
      .set({
        status: "done",
        steps,
        cardsCreated,
        finishedAt: new Date(),
      })
      .where(eq(agentJobs.id, jobId));

    return { ok: true, cardsCreated, steps: steps.length, model: label };
  } catch (error) {
    await db
      .update(agentJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      })
      .where(eq(agentJobs.id, jobId));
    throw error;
  }
}

/**
 * The trace is stored as jsonb and rendered in the UI, so base64 image payloads
 * have to come out before it is written. We keep the shape, drop the bytes.
 */
function stripBlobs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBlobs);
  // Dates have no enumerable keys, so the generic object branch would flatten
  // them to `{}`.
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === "data" && typeof inner === "string"
          ? `<${inner.length} base64 chars>`
          : stripBlobs(inner),
      ]),
    );
  }
  return value;
}

/**
 * Fails jobs that never finished. `running` means the agent died mid-flight;
 * `pending` means the trigger never arrived — a dropped fire-and-forget call,
 * or an agent endpoint that rejected the request.
 */
export async function reapStaleJobs() {
  await db
    .update(agentJobs)
    .set({
      status: "failed",
      error: "Timed out — the agent never reported back.",
      finishedAt: new Date(),
    })
    .where(
      sql`${agentJobs.status} in ('pending', 'running')
          and ${agentJobs.createdAt} < now() - interval '5 minutes'`,
    );
}
