# Notecards

A notes app where saving is the trigger. Write what you're learning — rich text,
pasted screenshots and diagrams — hit save, and an agent reads *what changed
since the last save* and writes flashcards for the new material. Installable as
a PWA.

The point of the project is the agent, not the CRUD: it has tools, it decides
which to call, and it writes to the database itself. Every run is recorded so
you can see exactly what it did.

## Screenshots

| Notes | Review |
|---|---|
| ![Notes editor](docs/screenshots/notes.png) | ![Review deck](docs/screenshots/review.png) |

## How a save becomes flashcards

```
PUT /api/notes/[id]
  ├─ diff against the last version
  ├─ trivial change?  → stop, no agent run, no API spend
  └─ insert agent_jobs row (status: pending)
        ├─ after()  → run the agent inline, once the response has gone out
        └─ QStash   → backup delivery, delayed, in case the inline run is
                       killed by the platform's duration cap
              └─ agent loop (max 8 steps)
                    ├─ getNoteDiff()            what's actually new
                    ├─ readNote()               surrounding context
                    ├─ viewImages([...])        looks at pasted images
                    ├─ getExistingFlashcards()  don't repeat yourself
                    └─ saveFlashcards([...])    agent writes its own rows
              └─ job → done, with the full tool trace stored
```

Both paths claim the job with a lease before running it, so whichever arrives
first does the work and the other is skipped — the job gets done if *either*
path works, rather than only if the chosen one does.

The browser polls the note until the job settles, then shows the cards and the
trace.

### Why it's shaped this way

- **The agent owns the write path.** Cards reach the database only through the
  agent's `saveFlashcards` tool. We never parse prose into rows.
- **The trigger doesn't depend on external infra.** Saving runs the agent
  inline after the response is sent, so local dev needs nothing extra. With a
  `QSTASH_TOKEN` set, a delayed backup delivery through a real queue picks up
  any run the platform killed mid-flight.
- **Runs are cheap to skip.** A save that adds fewer than 40 characters of new
  prose doesn't start a run, and only one job per note is in flight at a time.
- **The agent can see, not just read.** `viewImages` returns real image bytes
  as model content, so a diagram or screenshot is studied like any other
  material. Image payloads are stripped from the stored trace.
- **Failures are visible, not silent.** Jobs move `pending → running →
  done | failed`. A missing API key fails the job with that message rather than
  leaving it pending; anything stuck past its lease gets reaped and retried.

## Provider-agnostic by construction

`src/lib/model.ts` is the only file that knows a vendor exists. Everything else
works against the AI SDK's `LanguageModel` type, so switching models is an env
var:

```bash
AI_PROVIDER=google     AI_MODEL=gemini-3.6-flash
AI_PROVIDER=anthropic  AI_MODEL=claude-sonnet-5
AI_PROVIDER=openai     AI_MODEL=gpt-5
AI_PROVIDER=xai        AI_MODEL=grok-4
```

The tool definitions, the agent loop, and the prompt are unchanged across all
four. Which model ran is recorded on every job.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router), React 19 |
| UI | shadcn/ui + Tailwind v4 |
| Editor | Tiptap (bold/italic/underline, headings, lists, code, images) |
| Theming | next-themes, light + dark |
| DB | Neon Postgres + Drizzle |
| Agent | Vercel AI SDK v7 tool-calling loop |
| Queue | Upstash QStash (optional) |

## Running it

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` (from the Neon console) and
`GOOGLE_GENERATIVE_AI_API_KEY`, then:

```bash
npm run db:push
```

```bash
npm run dev
```

Write a note with a few real facts in it, hit save (or `⌘S`), and watch the
Agent tab.

## Deploying

Push to GitHub, import into Vercel, and set the same env vars there plus
`APP_URL` (your deployed URL) so the app can reach its own agent endpoint. For
the queued path, add `QSTASH_TOKEN` from Upstash.

## Rich text and images

The editor stores two things per note: the HTML it renders, and the same content
flattened to plain text. Diffs and the agent read the flattened text, so
bolding a word doesn't read as new material — but pasting an image does.

Pasted and dropped images upload to `/api/images` and are stored as base64 rows,
which keeps the project runnable without an object store. The editor references
them as `/api/images/<id>`; the agent pulls the same ids out of the HTML and
passes them to `viewImages`. For image-heavy use, swap that one table for S3 or
Vercel Blob — nothing else changes.

## Pages

Notes, Review and Agent are real routes (`/`, `/review`, `/agent`), not panels
in one page — so a reload, a bookmark, or the back button all land where you
expect, and each page gets its own title. They are statically prerendered and
prefetched, so switching between them stays instant.

Light and dark both ship. The toggle sits in the header and follows the system
preference until you override it, after which the choice persists.

## Review

Cards live only here — the editor is just for writing. The Review page is one
deck per note. Each deck shows a single card face-up on a
visible pile: click to reveal the answer, arrows to move through it, and a
position counter above. Decks load four at a time and the next page fetches when
a sentinel scrolls into view, so a large library never loads at once.

Paging is by offset over `updated_at DESC`, which can repeat a row if a note is
saved mid-scroll — appended pages are deduplicated by id to absorb that.

## Schema

- `notes` — title, HTML body, flattened text, version counter
- `note_versions` — immutable snapshot per save; what the diff runs against
- `note_images` — pasted images, referenced from the body HTML
- `agent_jobs` — one row per run: status, model, tool trace, cards created
- `flashcards` — written by the agent, linked to the note and the job

## Running against local Postgres

`DATABASE_URL` picks the driver: a `neon.tech` host uses Neon's HTTP driver,
anything else uses a normal TCP connection. So a container works for local dev:

```bash
docker run -d --name notecards-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=notecards -p 55432:5432 postgres:16-alpine
```

Point `DATABASE_URL` at `postgresql://postgres:postgres@localhost:55432/notecards`
and run `npm run db:push`.

To exercise the agent's tools against a real note without spending a token:

```bash
npm run agent:smoke -- <noteId>
```

To fill the Review tab with demo decks (no agent runs, no API spend):

```bash
npm run seed:demo
```

Remove them again with `npm run seed:demo -- --clean`.

## Contributing

Bug reports and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
