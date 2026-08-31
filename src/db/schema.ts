import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A note the user is writing. `body` is the editor's HTML; `bodyText` is the
 * same content flattened to plain text. Diffs run against `bodyText` because
 * diffing HTML would treat a bold toggle as new material.
 */
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled"),
  body: text("body").notNull().default(""),
  bodyText: text("body_text").notNull().default(""),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Immutable snapshot of a note at each save. The agent diffs against these. */
export const noteVersions = pgTable(
  "note_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    bodyText: text("body_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("note_versions_note_idx").on(t.noteId, t.version)],
);

/**
 * Images pasted into a note, stored as base64 alongside everything else so the
 * project needs no blob store to run. Swap this table for object storage if
 * notes ever get image-heavy.
 */
export const noteImages = pgTable(
  "note_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("note_images_note_idx").on(t.noteId, t.createdAt)],
);

/** One unit of work for the agent. Created on save, consumed by the runner. */
export const agentJobs = pgTable(
  "agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    /** Version of the note this job was created for. */
    version: integer("version").notNull(),
    /** pending | running | done | failed | skipped */
    status: text("status").notNull().default("pending"),
    /** Which provider/model actually ran, recorded for the demo. */
    model: text("model"),
    /** Trace of what the agent did: tool calls, args, results. */
    steps: jsonb("steps").$type<AgentStep[]>().notNull().default([]),
    cardsCreated: integer("cards_created").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_jobs_note_idx").on(t.noteId, t.createdAt)],
);

/** What the agent produced. Written by the agent itself via its save tool. */
export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => agentJobs.id, {
      onDelete: "set null",
    }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("flashcards_note_idx").on(t.noteId, t.createdAt)],
);

export type AgentStep = {
  tool: string;
  input: unknown;
  output: unknown;
};

export type Note = typeof notes.$inferSelect;
export type NoteImage = typeof noteImages.$inferSelect;
export type AgentJob = typeof agentJobs.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
