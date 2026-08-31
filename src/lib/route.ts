import { NextResponse } from "next/server";

/**
 * Wraps a route handler so thrown errors come back as JSON the client can
 * display, instead of Next's empty 500 body.
 */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Drizzle wraps driver errors and puts the real reason ("password
      // authentication failed", "relation does not exist") on `cause`, so
      // reporting only `message` hides what actually went wrong.
      console.error(error);
      return NextResponse.json({ error: describe(error) }, { status: 500 });
    }
  };
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  return cause instanceof Error ? `${error.message} — ${cause.message}` : error.message;
}
