import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * The only place in the codebase that knows which vendor we are talking to.
 * Everything downstream (agent, tools, routes) works against `LanguageModel`,
 * so switching providers is an env var change, not a code change.
 *
 *   AI_PROVIDER=google  AI_MODEL=gemini-3.6-flash
 *   AI_PROVIDER=anthropic  AI_MODEL=claude-sonnet-5
 *   AI_PROVIDER=openai  AI_MODEL=gpt-5
 *   AI_PROVIDER=xai  AI_MODEL=grok-4          (OpenAI-compatible endpoint)
 */
export type Provider = "google" | "anthropic" | "openai" | "xai";

const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-3.6-flash",
  anthropic: "claude-sonnet-5",
  openai: "gpt-5",
  xai: "grok-4",
};

export function resolveProvider(): Provider {
  const p = (process.env.AI_PROVIDER ?? "google").toLowerCase();
  if (p in DEFAULT_MODELS) return p as Provider;
  throw new Error(
    `Unknown AI_PROVIDER "${p}". Expected one of: ${Object.keys(DEFAULT_MODELS).join(", ")}`,
  );
}

export function resolveModelId(provider = resolveProvider()): string {
  return process.env.AI_MODEL || DEFAULT_MODELS[provider];
}

function requireKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function getModel(): { model: LanguageModel; label: string } {
  const provider = resolveProvider();
  const modelId = resolveModelId(provider);
  const label = `${provider}:${modelId}`;

  switch (provider) {
    case "google":
      return {
        label,
        model: createGoogleGenerativeAI({
          apiKey: requireKey("GOOGLE_GENERATIVE_AI_API_KEY"),
        })(modelId),
      };
    case "anthropic":
      return {
        label,
        model: createAnthropic({ apiKey: requireKey("ANTHROPIC_API_KEY") })(
          modelId,
        ),
      };
    case "openai":
      return {
        label,
        model: createOpenAI({ apiKey: requireKey("OPENAI_API_KEY") })(modelId),
      };
    case "xai":
      // Grok speaks the OpenAI wire format, so the OpenAI provider drives it.
      return {
        label,
        model: createOpenAI({
          apiKey: requireKey("XAI_API_KEY"),
          baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
        })(modelId),
      };
  }
}
