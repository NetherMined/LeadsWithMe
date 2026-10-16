import Anthropic, { APIError } from "@anthropic-ai/sdk";

export const DEFAULT_AI_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_FALLBACK_MODEL = "openai/gpt-5.4-mini";
const FALLBACK_URL = "https://gen.pollinations.ai/v1/chat/completions";
const ANTHROPIC_TIMEOUT_MS = 120_000;
const FALLBACK_TIMEOUT_MS = 120_000;

let anthropicClient: Anthropic | null = null;
// Circuit breaker: skip Anthropic for 5 min after a billing error
let anthropicBillingErrorUntil = 0;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: ANTHROPIC_TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return anthropicClient;
}

/** Out of credit / plan limits. Older API versions report low credit as a 400 invalid_request_error. */
function isBillingError(err: unknown): err is APIError {
  if (!(err instanceof APIError)) return false;
  if (err.status === 402 || err.type === "billing_error") return true;
  return err.status === 400 && err.type === "invalid_request_error" && /credit balance/i.test(err.message);
}

export interface CompletionResult {
  text: string;
  tokensInput?: number;
  tokensOutput?: number;
  model: string;
}

export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<CompletionResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;

  if (!anthropicKey && !pollinationsKey) {
    throw new Error("No AI API key configured. Set ANTHROPIC_API_KEY or POLLINATIONS_API_KEY.");
  }

  let anthropicError: Error | null = null;

  // Try Claude first (skip if circuit breaker is open)
  if (anthropicKey && Date.now() > anthropicBillingErrorUntil) {
    try {
      const model = options?.model ?? process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
      const client = getAnthropicClient();
      const message = await client.messages.create({
        model,
        max_tokens: options?.maxTokens ?? 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      if (!text) throw new Error("Unexpected response from Claude");
      return {
        text,
        tokensInput: message.usage.input_tokens,
        tokensOutput: message.usage.output_tokens,
        model,
      };
    } catch (err) {
      if (!pollinationsKey || !isBillingError(err)) throw err;
      anthropicError = err;
      anthropicBillingErrorUntil = Date.now() + 5 * 60 * 1000; // skip for 5 min
      console.warn("[AI] Anthropic billing error — circuit open for 5 min, falling back to Pollinations:", err.message);
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
    if (res.status === 429) {
      if (anthropicError) {
        throw new Error(`Anthropic billing error (${anthropicError.message}) and Pollinations is rate-limited. Check your Anthropic billing at console.anthropic.com.`);
      }
      throw new Error("Pollinations rate limit exceeded. Try again in a minute.");
    }
    throw new Error(`Pollinations API error: ${res.status} — ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Pollinations returned an empty completion");
  const tokensInput = data.usage?.prompt_tokens as number | undefined;
  const tokensOutput = data.usage?.completion_tokens as number | undefined;
  return { text, tokensInput, tokensOutput, model: `pollinations/${pollinationsModel}` };
}
