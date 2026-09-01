import { NextResponse } from "next/server";
import { runAgentJob } from "@/agent/run";
import { authorizeAgentRequest } from "@/lib/agent-auth";

// The agent loop makes several model calls; give it room. Note that Vercel's
// Hobby plan caps functions at 60s regardless, which is what QStash retries
// are for.
export const maxDuration = 120;

/**
 * The agent endpoint. Called by QStash in production, or by the app's own
 * fire-and-forget trigger locally. Never called directly by the browser.
 */
export async function POST(request: Request) {
  // The raw body is needed for signature verification, so it is read once
  // here and parsed afterwards rather than via request.json().
  const body = await request.text();

  const auth = await authorizeAgentRequest(request, body);
  if (!auth.ok) {
    console.warn(`Rejected agent request: ${auth.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let jobId: string | undefined;
  try {
    jobId = (JSON.parse(body) as { jobId?: string }).jobId;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

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
