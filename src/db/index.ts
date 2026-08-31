import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Both drivers expose the same query-builder surface. We type against the Neon
// one — a union of the two would collapse Drizzle's overloads and break
// `.returning({ ... })` at the call sites.
type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

let instance: Db | null = null;

function connect(): Db {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  // Neon over HTTP in production; plain TCP for a local Postgres, so the
  // project can be run without a Neon account.
  instance = url.includes("neon.tech")
    ? drizzleNeon(neon(url), { schema })
    : (drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as Db);

  return instance;
}

// Connect on first query, not on import — otherwise `next build` would need a
// live database just to collect the routes.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = connect() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
