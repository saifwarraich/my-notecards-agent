import { headers } from "next/headers";

/**
 * Trigger boundary. Saving a note never runs the agent inline — it enqueues a
 * job and returns. In production QStash delivers the job (with retries and
 * signature verification); locally we fall back to a fire-and-forget POST to
 * the same endpoint, authenticated with a shared secret.
 */
export async function enqueueAgentJob(jobId: string) {
  const target = `${await baseUrl()}/api/agent/run`;
  const body = JSON.stringify({ jobId });

  if (process.env.QSTASH_TOKEN) {
    await fetch(`https://qstash.upstash.io/v2/publish/${target}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Retries": "2",
      },
      body,
    });
    return { via: "qstash" as const };
  }

  // Fire and forget: we do not await, so save latency stays flat.
  void fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": process.env.AGENT_SECRET ?? "",
    },
    body,
  }).catch(() => {
    // The job stays `pending` and can be retried from the UI.
  });

  return { via: "direct" as const };
}

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
