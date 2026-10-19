import "server-only";

/**
 * DeepSeek V4.1 Flash (free) through the local OpenCode background service (`opencode service`).
 *
 * OpenCode's free models only answer requests made by OpenCode itself, so each completion
 * runs as a throwaway OpenCode session. That session is an agent with tools, and prompts
 * carry scraped website text, so every action is set to "ask" and every permission request
 * is rejected: the model can ask to run a tool, but nothing ever runs.
 *
 * Uses OpenCode v2's /api routes, which are not publicly documented. Verified against
 * opencode 2.0.32; re-test after OpenCode upgrades.
 */

export const DEFAULT_OPENCODE_MODEL = "opencode/deepseek-v4.1-flash-free";
const DEFAULT_OPENCODE_URL = "http://127.0.0.1:4096";
const POLL_MS = 750;

export class OpenCodeError extends Error {
  constructor(message: string, readonly unavailable = false) {
    super(message);
    this.name = "OpenCodeError";
  }
}

export function isOpenCodeConfigured(): boolean {
  return Boolean(process.env.OPENCODE_SERVER_PASSWORD);
}

export function openCodeModel(): string {
  return process.env.OPENCODE_MODEL || DEFAULT_OPENCODE_MODEL;
}

interface OpenCodePart {
  type: string;
  text?: string;
}

interface OpenCodeMessage {
  id: string;
  type: "user" | "assistant" | "idle" | string;
  outcome?: string;
  finish?: string;
  content?: OpenCodePart[];
  error?: { type?: string; message?: string };
}

function baseUrl(): string {
  return (process.env.OPENCODE_URL || DEFAULT_OPENCODE_URL).replace(/\/+$/, "");
}

function authHeader(): string {
  const user = process.env.OPENCODE_SERVER_USERNAME || "opencode";
  const password = process.env.OPENCODE_SERVER_PASSWORD ?? "";
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: { Authorization: authHeader(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new OpenCodeError(`OpenCode service unreachable at ${baseUrl()}: ${(err as Error).message}`, true);
  }
  if (res.status === 401) throw new OpenCodeError("OpenCode rejected the credentials (check OPENCODE_SERVER_PASSWORD)", true);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenCodeError(`OpenCode ${method} ${path} failed: HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}

function parseModel(ref: string): { providerID: string; id: string } {
  const slash = ref.indexOf("/");
  if (slash <= 0) throw new OpenCodeError(`OPENCODE_MODEL must look like provider/model, got "${ref}"`);
  return { providerID: ref.slice(0, slash), id: ref.slice(slash + 1) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function messageText(m: OpenCodeMessage): string {
  return (m.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
}

/**
 * The answer is the latest assistant message with text. When a reply hits the output
 * token limit (finish "length"), OpenCode adds a synthetic "continue" turn and the next
 * message picks up mid-token, so the run of truncated messages before it is joined back on.
 * `assistant` is newest first.
 */
export function finalAnswer(assistant: OpenCodeMessage[]): string {
  const last = assistant.findIndex((m) => messageText(m).trim());
  if (last === -1) return "";
  let text = messageText(assistant[last]);
  for (let i = last + 1; i < assistant.length && assistant[i].finish === "length"; i++) {
    text = messageText(assistant[i]) + text;
  }
  return text;
}

export interface OpenCodeCompletion {
  text: string;
  tokensInput?: number;
  tokensOutput?: number;
  model: string;
}

export async function openCodeComplete(
  systemPrompt: string,
  userPrompt: string,
  { timeoutMs = 240_000 }: { timeoutMs?: number } = {}
): Promise<OpenCodeCompletion> {
  const modelRef = openCodeModel();
  const session = await call<{ id: string }>("POST", "/api/session", {
    title: "LeadSight completion",
    model: parseModel(modelRef),
    ...(process.env.OPENCODE_DIRECTORY ? { location: { directory: process.env.OPENCODE_DIRECTORY } } : {}),
    // "ask" keeps the tools in the request (OpenCode's free tier requires that) while
    // guaranteeing none runs without approval, which this module never gives.
    permissions: [{ action: "*", resource: "*", effect: "ask" }],
  });
  const sessionPath = `/api/session/${encodeURIComponent(session.id)}`;

  try {
    const text = [
      "You are being used as a plain text-generation API, not a coding agent.",
      "Tools are disabled: never call a tool. Reply with only the requested output.",
      "",
      systemPrompt,
      userPrompt ? `\n---\n\n${userPrompt}` : "",
    ].join("\n");
    await call("POST", `${sessionPath}/prompt`, { text });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);

      const pending = await call<{ id: string; action: string }[]>("GET", `${sessionPath}/permission`);
      for (const request of pending ?? []) {
        console.warn(`[AI] OpenCode requested tool "${request.action}" — rejected`);
        await call("POST", `${sessionPath}/permission/${encodeURIComponent(request.id)}/reply`, {
          decision: "reject",
          message: "Tools are disabled. Answer in plain text only.",
        });
      }

      const messages = await call<OpenCodeMessage[]>("GET", `${sessionPath}/message?limit=50&order=desc`);
      const idle = messages.find((m) => m.type === "idle");
      if (!idle) continue;

      const assistant = messages.filter((m) => m.type === "assistant");
      const failed = assistant.find((m) => m.error);
      if (idle.outcome === "failed" || (failed && !assistant.some((m) => m.finish === "stop"))) {
        const message = failed?.error?.message ?? "OpenCode generation failed";
        throw new OpenCodeError(message, failed?.error?.type === "provider.auth");
      }
      const answer = finalAnswer(assistant);
      if (!answer) throw new OpenCodeError("OpenCode returned an empty completion");

      const info = await call<{ tokens?: { input?: number; output?: number } }>("GET", sessionPath).catch(() => null);
      return { text: answer, tokensInput: info?.tokens?.input, tokensOutput: info?.tokens?.output, model: modelRef };
    }

    await call("POST", `${sessionPath}/interrupt`).catch(() => {});
    throw new OpenCodeError(`OpenCode did not finish within ${Math.round(timeoutMs / 1000)}s`);
  } finally {
    await call("DELETE", sessionPath).catch(() => {});
  }
}
