import { tool } from "ai";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db, flashcards, noteImages, noteVersions, notes } from "@/db";
import { diffLines } from "@/lib/diff";

/**
 * The agent's toolbelt. The agent decides what to call and in what order — we
 * never parse its prose into rows. `saveFlashcards` is the only way cards reach
 * the database, so the write path is the agent's own decision.
 */
export function buildTools(ctx: { noteId: string; jobId: string }) {
  return {
    readNote: tool({
      description:
        "Read the note's title and full text, plus the ids of any images embedded in it.",
      inputSchema: z.object({}),
      execute: async () => {
        const [note] = await db
          .select()
          .from(notes)
          .where(eq(notes.id, ctx.noteId));
        if (!note) return { error: "note not found" };

        return {
          title: note.title,
          text: note.bodyText,
          version: note.version,
          imageIds: extractImageIds(note.body),
        };
      },
    }),

    getNoteDiff: tool({
      description:
        "Get the lines added and removed since the previous saved version, and which images are new. Use this to focus on genuinely new material instead of re-covering the whole note.",
      inputSchema: z.object({}),
      execute: async () => {
        const [current] = await db
          .select()
          .from(notes)
          .where(eq(notes.id, ctx.noteId));
        if (!current) return { error: "note not found" };

        const [previous] = await db
          .select()
          .from(noteVersions)
          .where(
            and(
              eq(noteVersions.noteId, ctx.noteId),
              lt(noteVersions.version, current.version),
            ),
          )
          .orderBy(desc(noteVersions.version))
          .limit(1);

        const { added, removed } = diffLines(
          previous?.bodyText ?? "",
          current.bodyText,
        );

        const currentImages = extractImageIds(current.body);
        const previousImages = new Set(extractImageIds(previous?.body ?? ""));

        return {
          isFirstVersion: !previous,
          addedLines: added,
          removedLines: removed,
          newImageIds: currentImages.filter((id) => !previousImages.has(id)),
        };
      },
    }),

    viewImages: tool({
      description:
        "Look at images embedded in the note. Pass the image ids from readNote or getNoteDiff. Use this whenever the note has a diagram, screenshot, or photo that carries information the text does not.",
      inputSchema: z.object({
        imageIds: z.array(z.string()).min(1).max(4),
      }),
      execute: async ({ imageIds }) => {
        const rows = await db
          .select()
          .from(noteImages)
          .where(
            and(
              eq(noteImages.noteId, ctx.noteId),
              inArray(noteImages.id, imageIds),
            ),
          );
        return { images: rows.map((r) => ({ ...r, noteId: undefined })) };
      },
      // Hands the actual pixels to the model. Without this the model would only
      // receive the JSON row, base64 blob and all, which no provider reads as
      // an image.
      toModelOutput: ({ output }) => {
        const images = (output as { images: { id: string; mediaType: string; data: string }[] })
          .images;
        if (images.length === 0) {
          return { type: "text", value: "No images matched those ids." };
        }
        return {
          type: "content",
          value: images.flatMap((image) => [
            { type: "text" as const, text: `Image ${image.id}:` },
            {
              type: "file" as const,
              data: { type: "data" as const, data: image.data },
              mediaType: image.mediaType,
            },
          ]),
        };
      },
    }),

    getExistingFlashcards: tool({
      description:
        "List flashcards that already exist for this note, so you do not create duplicates.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({ front: flashcards.front, back: flashcards.back })
          .from(flashcards)
          .where(eq(flashcards.noteId, ctx.noteId))
          .orderBy(desc(flashcards.createdAt))
          .limit(100);
        return { count: rows.length, cards: rows };
      },
    }),

    saveFlashcards: tool({
      description:
        "Persist new flashcards for this note. Call once with every card you want to keep. Call with an empty array if the change did not introduce anything worth memorising.",
      inputSchema: z.object({
        cards: z
          .array(
            z.object({
              front: z.string().describe("The question or prompt side."),
              back: z.string().describe("The answer side. Keep it tight."),
            }),
          )
          .max(20),
        reasoning: z
          .string()
          .describe("One sentence on why these cards, or why none."),
      }),
      execute: async ({ cards }) => {
        if (cards.length === 0) return { saved: 0 };
        await db.insert(flashcards).values(
          cards.map((c) => ({
            noteId: ctx.noteId,
            jobId: ctx.jobId,
            front: c.front,
            back: c.back,
          })),
        );
        return { saved: cards.length };
      },
    }),
  };
}

/** Pulls image ids out of the editor's `<img src="/api/images/UUID">` tags. */
export function extractImageIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(/\/api\/images\/([0-9a-f-]{36})/gi)) {
    ids.add(match[1]);
  }
  return [...ids];
}
