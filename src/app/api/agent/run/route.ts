import { NextResponse } from "next/server";
import { runAgentJob } from "@/agent/run";

// The agent loop makes several model calls; give it room.
export const maxDuration = 120;

/**
 * The agent endpoint. Called by QStash in production, or by the app's own
 * fire-and-forget trigger locally. Never called directly by the browser.
 */
export async function POST(request: Request) {
  const secret = process.env.AGENT_SECRET;
  const fromQStash = request.headers.get("upstash-signature") !== null;

  if (!fromQStash && secret && request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = (await request.json()) as { jobId?: string };
  if (!jobId)
    return NextResponse.json({ error: "jobId required" }, { status: 400 });

  try {
    const result = await runAgentJob(jobId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
