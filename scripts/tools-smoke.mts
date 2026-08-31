/**
 * Exercises the agent's tools against a real note without calling a model.
 * Useful when you have a database but no API key yet.
 *
 *   npx tsx --env-file=.env scripts/tools-smoke.ts <noteId>
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { agentJobs, notes } from "../src/db/schema";
import { buildTools } from "../src/agent/tools";

const noteId = process.argv[2];
if (!noteId) throw new Error("usage: tools-smoke.ts <noteId>");

const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
if (!note) throw new Error(`no note ${noteId}`);

const [job] = await db
  .select()
  .from(agentJobs)
  .where(eq(agentJobs.noteId, noteId))
  .orderBy(desc(agentJobs.createdAt))
  .limit(1);

const tools = buildTools({ noteId, jobId: job.id });
const call = async (name: keyof typeof tools, input: unknown) =>
  // The tools only use `input`; the rest of the execute options are unused.
  (tools[name].execute as (i: unknown, o: unknown) => Promise<unknown>)(
    input,
    {},
  );

const diff = (await call("getNoteDiff", {})) as { newImageIds: string[] };
console.log("getNoteDiff:", JSON.stringify(diff, null, 2));
console.log("\nreadNote:", JSON.stringify(await call("readNote", {}), null, 2));

if (diff.newImageIds.length > 0) {
  const seen = (await call("viewImages", {
    imageIds: diff.newImageIds,
  })) as { images: { id: string; mediaType: string; data: string }[] };
  console.log(
    "\nviewImages:",
    seen.images.map((i) => ({
      id: i.id,
      mediaType: i.mediaType,
      base64Chars: i.data.length,
    })),
  );

  const toModelOutput = tools.viewImages.toModelOutput as (o: {
    toolCallId: string;
    input: unknown;
    output: unknown;
  }) => unknown;
  const modelOutput = toModelOutput({
    toolCallId: "t",
    input: { imageIds: diff.newImageIds },
    output: seen,
  });
  console.log(
    "\nwhat the model receives:",
    JSON.stringify(modelOutput, (k, v) =>
      k === "data" && typeof v === "string" ? `<${v.length} chars>` : v,
    ),
  );
}

process.exit(0);
