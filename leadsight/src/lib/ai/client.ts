import { isOpenCodeConfigured, openCodeComplete, OpenCodeError } from "./opencode";

const DEFAULT_FALLBACK_MODEL = "openai/gpt-5.4-mini";
const FALLBACK_URL = "https://gen.pollinations.ai/v1/chat/completions";
const FALLBACK_TIMEOUT_MS = 120_000;

// Circuit breaker: skip OpenCode for 2 min after it is unreachable or refuses the request
let openCodeUnavailableUntil = 0;

export interface CompletionResult {
  text: string;
  tokensInput?: number;
  tokensOutput?: number;
  model: string;
}

/** Usage-tracking service name for a completion's model. */
export function aiService(model: string): "opencode" | "pollinations" {
  return model.startsWith("pollinations/") ? "pollinations" : "opencode";
}

export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<CompletionResult> {
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;

  if (!isOpenCodeConfigured() && !pollinationsKey) {
    throw new Error("No AI provider configured. Set OPENCODE_SERVER_PASSWORD (local OpenCode) or POLLINATIONS_API_KEY.");
  }

  let openCodeError: Error | null = null;

  // DeepSeek V4.1 Flash via the local OpenCode service first (skip if circuit breaker is open)
  if (isOpenCodeConfigured() && Date.now() > openCodeUnavailableUntil) {
    try {
      return await openCodeComplete(systemPrompt, userPrompt);
    } catch (err) {
      openCodeError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof OpenCodeError && err.unavailable) {
        openCodeUnavailableUntil = Date.now() + 2 * 60 * 1000;
      }
      if (!pollinationsKey) throw openCodeError;
      console.warn("[AI] OpenCode failed, falling back to Pollinations:", openCodeError.message);
    }
  }

  // Pollinations fallback — OpenAI-compatible endpoint, respects Retry-After, up to 2 retries
  const pollinationsModel = process.env.POLLINATIONS_MODEL ?? DEFAULT_FALLBACK_MODEL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pollinationsKey) headers["Authorization"] = `Bearer ${pollinationsKey}`;

  const body = JSON.stringify({
    model: pollinationsModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens ?? 4000,
  });

  const callPollinations = () =>
    fetch(FALLBACK_URL, { method: "POST", headers, body, signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) });

  let res = await callPollinations();

  for (let attempt = 0; attempt < 2 && res.status === 429; attempt++) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 15);
    const waitMs = Math.min(retryAfter * 1000, 60000);
    console.warn(`[AI] Pollinations 429 — waiting ${waitMs / 1000}s (attempt ${attempt + 1}/2)`);
    await new Promise(r => setTimeout(r, waitMs));
    res = await callPollinations();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const prefix = openCodeError ? `OpenCode failed (${openCodeError.message}) and ` : "";
    if (res.status === 429) throw new Error(`${prefix}Pollinations rate limit exceeded. Try again in a minute.`);
    throw new Error(`${prefix}Pollinations API error: ${res.status} — ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Pollinations returned an empty completion");
  const tokensInput = data.usage?.prompt_tokens as number | undefined;
  const tokensOutput = data.usage?.completion_tokens as number | undefined;
  return { text, tokensInput, tokensOutput, model: `pollinations/${pollinationsModel}` };
}
