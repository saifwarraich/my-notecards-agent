import { Receiver } from "@upstash/qstash";

/**
 * Decides whether a request may run the agent.
 *
 * Two callers are legitimate: QStash, which signs every delivery, and the
 * app's own fire-and-forget trigger, which carries a shared secret. The
 * signature is verified cryptographically — merely *having* an
 * `upstash-signature` header proves nothing, since anyone can send one.
 */
export async function authorizeAgentRequest(
  request: Request,
  body: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const signature = request.headers.get("upstash-signature");

  if (signature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) {
      return {
        ok: false,
        reason:
          "Signed request received but QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY are not set.",
      };
    }

    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });

    try {
      const valid = await receiver.verify({ signature, body });
      return valid ? { ok: true } : { ok: false, reason: "Invalid signature." };
    } catch {
      return { ok: false, reason: "Invalid signature." };
    }
  }

  const secret = process.env.AGENT_SECRET;
  if (!secret) {
    return { ok: false, reason: "AGENT_SECRET is not set." };
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return { ok: false, reason: "Bad or missing agent secret." };
  }
  return { ok: true };
}
