"use client";

import { toast } from "sonner";

/**
 * Every client fetch goes through here. A missing DATABASE_URL or API key is
 * the most likely thing to go wrong on a fresh clone, so failures have to be
 * loud rather than leaving the UI mysteriously empty.
 */
export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    ...(json !== undefined
      ? {
          body: JSON.stringify(json),
          headers: { "Content-Type": "application/json", ...rest.headers },
        }
      : {}),
  });

  if (!res.ok) {
    const message = await errorMessage(res);
    toast.error(message);
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function errorMessage(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return `Request failed (${res.status}). Check DATABASE_URL and your API key.`;
}
