import { headers } from "next/headers";
import { after } from "next/server";

/**
 * Trigger boundary. Saving a note never runs the agent inline — it records a
 * job and hands off, so save latency does not depend on a model call.
 *
 * Two ways to hand off:
 *
 * - QStash calls the agent endpoint for us and retries if that call fails or
 *   times out. This is the durable path: use it in production, where a run can
 *   outlive the function that started it.
 *
 * - Otherwise the work is scheduled with `after()`, which keeps the current
 *   invocation alive until it finishes. A bare `fetch()` without awaiting does
 *   NOT work here — the platform may freeze the instance as soon as the
 *   response is sent, dropping the request and leaving the job pending
 *   forever.
 */
export async function enqueueAgentJob(jobId: string) {
  let publishError: string | null = null;
  const target = `${await baseUrl()}/api/agent/run`;

  // QStash calls us over the public internet, so it cannot reach a dev server.
  if (process.env.QSTASH_TOKEN && isPubliclyReachable(target)) {
    try {
      const response = await fetch(
        `https://qstash.upstash.io/v2/publish/${target}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
            "Content-Type": "application/json",
            "Upstash-Retries": "3",
          },
          body: JSON.stringify({ jobId }),
        },
      );

      if (response.ok) return { via: "qstash" as const, detail: "queued via QStash" };

      // Never swallow this. A rejected publish means the job is never
      // delivered, and without a log there is nothing to see in QStash, in the
      // model provider, or on the job itself.
      publishError = `QStash publish failed (${response.status}): ${await response.text()}`;
      console.error(`${publishError} — falling back to after()`);
    } catch (error) {
      publishError = `QStash publish threw: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`${publishError} — falling back to after()`);
    }
  }

  // Run it in this invocation, after the response has gone out. No HTTP hop,
  // no shared secret, and nothing for the platform to cut short.
  const { runAgentJob } = await import("@/agent/run");
  after(async () => {
    try {
      await runAgentJob(jobId);
    } catch (error) {
      // The job row already records the failure; this is for the logs.
      console.error(`Agent job ${jobId} failed:`, error);
    }
  });

  return {
    via: "after" as const,
    detail: publishError
      ? `${publishError} — ran inline instead`
      : "ran inline via after()",
  };
}

function isPubliclyReachable(url: string) {
  const { hostname } = new URL(url);
  return !(
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
