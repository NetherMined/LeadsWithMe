import { z } from "zod";
import type { MarketingPlan, PlanItem, PlanSection } from "@/types/plan";

const PlanItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  effort: z.enum(["quick_win", "medium", "strategic"]),
  estimated_impact: z.string(),
});

const PlanSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  items: z.array(PlanItemSchema),
});

const PlanSchema = z.object({
  executive_summary: z.string(),
  website_recommendations: PlanSectionSchema,
  social_recommendations: PlanSectionSchema,
  advertising_recommendations: PlanSectionSchema,
  quick_wins: z.array(PlanItemSchema),
  medium_term: z.array(PlanItemSchema),
  long_term: z.array(PlanItemSchema),
  outreach_email_draft: z.string(),
});

function extractJson(raw: string): string {
  // Extract from markdown code block first
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // Find first { to last }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

/**
 * Walk character-by-character to escape any unescaped control characters
 * (ASCII 0x00–0x1F) inside JSON string values — the most common cause of
 * JSON.parse failures when LLMs write multi-line or control-char text into
 * a JSON string field.
 */
function fixLiteralNewlinesInStrings(str: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\") { escaped = true; result += ch; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && code < 0x20) {
      // Escape all ASCII control chars properly
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      // All other control chars: use \uXXXX escape
      result += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    result += ch;
  }
  return result;
}

/**
 * Iteratively fix unescaped `"` characters at the exact position V8 reports.
 * Handles the common LLM pattern: `"description": "use "quotes" in text"`.
 */
/**
 * Iteratively repair common LLM JSON errors at the exact position V8 reports:
 * - Unescaped `"` inside a string value: `"use "quotes" here"` → escape the quote
 * - Missing comma between array/object elements: `[{...} {...}]` → insert `,`
 */
function repairJson(str: string, maxPasses = 20): string {
  let current = str;
  for (let i = 0; i < maxPasses; i++) {
    try {
      JSON.parse(current);
      return current;
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      const posMatch = e.message.match(/position (\d+)/);
      if (!posMatch) throw e;
      const pos = parseInt(posMatch[1]);

      // Missing comma between array or object elements
      if (e.message.includes("Expected ','") || e.message.includes("after array element") || e.message.includes("after object")) {
        current = current.slice(0, pos) + "," + current.slice(pos);
        continue;
      }

      // Unescaped quote inside a string
      if (current[pos] === '"') {
        current = current.slice(0, pos) + '\\"' + current.slice(pos + 1);
        continue;
      }

      throw e;
    }
  }
  return current;
}

export function parsePlanResponse(raw: string, businessId: string, modelUsed: string): MarketingPlan {
  const jsonStr = extractJson(raw);

  // Pass 1: fix trailing commas + all control chars
  const pass1 = fixLiteralNewlinesInStrings(
    jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(pass1);
  } catch {
    // Pass 2: iteratively repair structural errors at the reported position
    const pass2 = repairJson(pass1);
    parsed = JSON.parse(pass2);
  }

  const validated = PlanSchema.parse(parsed);

  return {
    id: crypto.randomUUID(),
    business_id: businessId,
    executive_summary: validated.executive_summary,
    website_recommendations: validated.website_recommendations as PlanSection,
    social_recommendations: validated.social_recommendations as PlanSection,
    advertising_recommendations: validated.advertising_recommendations as PlanSection,
    quick_wins: validated.quick_wins as PlanItem[],
    medium_term: validated.medium_term as PlanItem[],
    long_term: validated.long_term as PlanItem[],
    outreach_email_draft: validated.outreach_email_draft,
    generated_at: new Date().toISOString(),
    model_used: modelUsed,
  };
}
