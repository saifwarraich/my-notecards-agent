export type NoteSummary = {
  id: string;
  title: string;
  updatedAt: string;
  version: number;
  cardCount: number;
};

export type Note = {
  id: string;
  title: string;
  /** Editor HTML. */
  body: string;
  /** Same content flattened to plain text; what diffs and the agent read. */
  bodyText: string;
  version: number;
  updatedAt: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  noteId: string;
  noteTitle?: string;
};

export type AgentStep = { tool: string; input: unknown; output: unknown };

export type Job = {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  model: string | null;
  steps: AgentStep[];
  cardsCreated: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  noteId: string;
  noteTitle?: string;
};

export type SaveResult = {
  note: Note;
  job: Job | null;
  reason: "queued" | "unchanged" | "no-new-material" | "already-queued";
};
