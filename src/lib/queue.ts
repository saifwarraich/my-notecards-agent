import { headers } from "next/headers";
import { after } from "next/server";

/**
 * Trigger boundary. Saving a note never runs the agent inline — it records a
 * job and hands off, so save latency does not depend on a model call.
 *
 * The handoff is belt and braces, because the two mechanisms fail differently:
 *
 * - `after()` runs the agent in this invocation once the response has gone
 *   out. No network hop and nothing to misconfigure, so it works wherever the
 *   app itself works — but it dies with the invocation, so a run past the
 *   platform's duration cap is lost.
 *
 * - QStash calls the agent endpoint from outside and retries. That survives a
 *   killed run, but only if it can actually reach the endpoint: deployment
 *   protection, a stale deployment URL or missing signing keys all turn its
 *   delivery into a 401 the app never sees.
 *
 * So we do both. The claim in runAgentJob is a lease, so whichever arrives
 * first does the work and the other is skipped — the job gets done if *either*
 * path works, rather than only if the chosen one does.
 */
export async function enqueueAgentJob(jobId: string) {
  const notes: string[] = [];

  // Primary: run it here, after the response is sent.
  const { runAgentJob } = await import("@/agent/run");
  after(async () => {
    try {
      await runAgentJob(jobId);
    } catch (error) {
      // The job row already records the failure; this is for the logs.
      console.error(`Agent job ${jobId} failed:`, error);
    }
  });
  notes.push("ran inline via after()");

  // Backup: a retryable delivery in case the inline run is cut short.
  const target = `${await baseUrl()}/api/agent/run`;
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
            // No point delivering before the inline attempt has had its go.
            "Upstash-Delay": "120s",
          },
          body: JSON.stringify({ jobId }),
        },
      );
      notes.push(
        response.ok
          ? "QStash backup queued"
          : `QStash publish failed (${response.status}): ${await response.text()}`,
      );
    } catch (error) {
      notes.push(
        `QStash publish threw: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const detail = notes.join(" · ");
  if (notes.length > 1 && notes[1].startsWith("QStash publish f")) {
    console.error(detail);
  }
  return { detail };
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
  // VERCEL_PROJECT_PRODUCTION_URL is the stable domain; VERCEL_URL is the
  // per-deployment host, which deployment protection blocks by default — so a
  // callback aimed at it never arrives.
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
