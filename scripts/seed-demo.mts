/**
 * Inserts demo notes and flashcards so the Review tab has something to
 * paginate, without spending API credits on agent runs.
 *
 *   npx tsx --env-file=.env scripts/seed-demo.mts
 *   npx tsx --env-file=.env scripts/seed-demo.mts --clean
 *
 * Every seeded note title is prefixed "Demo:" so --clean can find them.
 */
import { like } from "drizzle-orm";
import { db } from "../src/db/index";
import { flashcards, notes } from "../src/db/schema";

const PREFIX = "Demo:";

if (process.argv.includes("--clean")) {
  // Flashcards cascade from the note.
  await db.delete(notes).where(like(notes.title, `${PREFIX}%`));
  console.log("removed demo notes");
  process.exit(0);
}

const topics: [string, [string, string][]][] = [
  [
    "Vector databases",
    [
      ["What does HNSW stand for?", "Hierarchical Navigable Small World — a graph index for approximate nearest-neighbour search."],
      ["Why is ANN used instead of exact nearest-neighbour search?", "Exact search is linear in the number of vectors; ANN trades a little recall for sub-linear query time."],
      ["What does the `ef_search` parameter control in HNSW?", "How many candidates the search keeps in flight — higher means better recall and slower queries."],
    ],
  ],
  [
    "Postgres indexing",
    [
      ["When is a partial index useful?", "When queries always filter on the same predicate — the index only stores matching rows, so it stays small."],
      ["What is a covering index?", "One that includes every column a query needs, so Postgres answers from the index alone without touching the heap."],
      ["Why can adding an index slow down writes?", "Every insert, update and delete must also maintain the index."],
    ],
  ],
  [
    "HTTP caching",
    [
      ["What does `Cache-Control: immutable` promise?", "The response body will never change at this URL, so the browser can skip revalidation entirely."],
      ["Difference between `ETag` and `Last-Modified`?", "ETag is an opaque content fingerprint; Last-Modified is a timestamp with one-second resolution."],
      ["What does `stale-while-revalidate` do?", "Serves the cached response immediately while fetching a fresh one in the background."],
    ],
  ],
  [
    "React rendering",
    [
      ["What problem does `useMemo` actually solve?", "It skips recomputing an expensive value when its dependencies have not changed."],
      ["Why does a new object literal in props break memoisation?", "It is a fresh reference every render, so the memo comparison always fails."],
      ["What is the point of a key in a list?", "It tells React which item is which across renders, so state follows the right element."],
    ],
  ],
  [
    "TypeScript types",
    [
      ["What does `satisfies` do that a type annotation does not?", "It checks the value against a type while keeping the narrower inferred type."],
      ["When is `unknown` better than `any`?", "Always, unless you are deliberately opting out — `unknown` forces a narrowing check before use."],
      ["What is a discriminated union?", "A union whose members share a literal tag field, letting the compiler narrow on that tag."],
    ],
  ],
  [
    "Async patterns",
    [
      ["Why does `Promise.all` reject on the first failure?", "It is all-or-nothing; use `Promise.allSettled` when you need every outcome."],
      ["What does an AbortController give you?", "A signal you can pass to fetch to cancel a request that is no longer needed."],
      ["What is a common cause of an unhandled rejection?", "Calling an async function without awaiting it and without a .catch()."],
    ],
  ],
];

for (const [title, cards] of topics) {
  const body = `<h1>${title}</h1><p>Seeded demo note.</p>`;
  const [note] = await db
    .insert(notes)
    .values({
      title: `${PREFIX} ${title}`,
      body,
      bodyText: `${title}\nSeeded demo note.`,
      version: 1,
    })
    .returning();

  await db.insert(flashcards).values(
    cards.map(([front, back]) => ({ noteId: note.id, front, back })),
  );
  console.log(`seeded "${title}" with ${cards.length} cards`);
}

process.exit(0);
