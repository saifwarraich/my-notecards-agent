# Contributing

Thanks for taking a look at Notecards. This is a small project, so the process
is small too.

## Getting set up

Follow [Running it](README.md#running-it) in the README — a Neon (or local
Postgres) database and one model API key is all you need. `npm run
agent:smoke` exercises the agent's tools without spending a token, and `npm
run seed:demo` fills the Review tab with demo decks if you just want to see
the UI.

## Making changes

- Open an issue before starting anything nontrivial, so we can agree on the
  approach first.
- Keep PRs focused — one change, one PR. Unrelated cleanup makes a diff harder
  to review.
- Match the existing style: no unnecessary abstractions, comments only where
  the *why* isn't obvious from the code.
- Run `npm run lint` before opening a PR.
- If you change the schema, include the Drizzle migration (`npm run
  db:generate`).

## Reporting bugs

Open an issue with what you did, what you expected, and what happened
instead. A note ID or job trace from the Agent tab is often enough to
reproduce a problem.

## License

By contributing, you agree your contributions are licensed under the
project's [MIT License](LICENSE).
