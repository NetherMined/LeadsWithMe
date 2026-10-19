import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { finalAnswer } = await import("@/lib/ai/opencode");

const msg = (text: string, finish?: string) => ({
  id: Math.random().toString(36),
  type: "assistant",
  finish,
  content: [{ type: "reasoning", text: "thinking…" }, { type: "text", text }],
});

describe("finalAnswer", () => {
  it("returns the latest assistant text", () => {
    expect(finalAnswer([msg("second", "stop"), msg("first", "stop")])).toBe("second");
  });

  it("joins a reply that OpenCode continued after hitting the output limit", () => {
    // Newest first, as the bridge reads them.
    const messages = [msg(" 19.8 0 0 1 2.1 4.2</html>", "stop"), msg("<!DOCTYPE html><html>…19.8", "length")];
    expect(finalAnswer(messages)).toBe("<!DOCTYPE html><html>…19.8 19.8 0 0 1 2.1 4.2</html>");
  });

  it("joins several truncated parts in order and stops at a complete earlier reply", () => {
    const messages = [msg("C", "stop"), msg("B", "length"), msg("A", "length"), msg("older", "stop")];
    expect(finalAnswer(messages)).toBe("ABC");
  });

  it("skips trailing messages without text", () => {
    expect(finalAnswer([msg("", "stop"), msg("answer", "stop")])).toBe("answer");
  });

  it("returns an empty string when no message has text", () => {
    expect(finalAnswer([msg("  ", "stop")])).toBe("");
  });
});
