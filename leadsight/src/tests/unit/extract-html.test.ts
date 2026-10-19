import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({ generateCompletion: vi.fn() }));

import { extractHtml } from "@/lib/demo/generateDemo";

const DOC = "<!DOCTYPE html>\n<html lang=\"en\"><head></head><body><p>Hi</p></body></html>";

describe("extractHtml", () => {
  it("returns a bare document unchanged", () => {
    expect(extractHtml(DOC)).toBe(DOC);
  });

  it("unwraps a fenced document with prose around it", () => {
    expect(extractHtml(`Here is the site:\n\`\`\`html\n${DOC}\n\`\`\`\nEnjoy!`)).toBe(DOC);
  });

  it("keeps the whole document when a continuation opens a fence mid-way", () => {
    const part1 = "<!DOCTYPE html>\n<html lang=\"en\"><head></head><body><p>Hel";
    const part2 = "```html\nlo</p></body></html>\n```";
    expect(extractHtml(part1 + part2)).toBe("<!DOCTYPE html>\n<html lang=\"en\"><head></head><body><p>Hello</p></body></html>");
  });

  it("keeps the last complete copy when the reply restarts the document", () => {
    const truncated = "<!DOCTYPE html>\n<html><body><p>Old";
    const restart = `\n\nSorry, starting again:\n${DOC}`;
    expect(extractHtml(truncated + restart)).toBe(DOC);
  });

  it("returns non-HTML text without an <html> tag so the caller can reject it", () => {
    expect(extractHtml("I cannot help with that.")).not.toMatch(/<html[\s>]/i);
  });
});
