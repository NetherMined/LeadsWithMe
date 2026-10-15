// src/lib/competitor/ab-tests.ts
import { generateCompletion } from "@/lib/ai/client";
import type { SiteComparison, ABTestSuggestion } from "@/types/report";

const SYSTEM_PROMPT = `You are a CRO (Conversion Rate Optimization) specialist with deep expertise in A/B testing for local business websites. You analyze competitor comparisons and generate specific, actionable A/B test suggestions that will measurably improve conversion rates.

Always respond with a valid JSON array of A/B test objects. Each test must have:
- testName: short descriptive name
- hypothesis: "If we [change], then [metric] will [improve] because [reason]"
- control: current state of the element being tested
- variant: proposed change to test
- metric: the specific metric to measure (e.g., "Contact form submissions", "Click-through rate on CTA")
- estimatedImpact: "low" | "medium" | "high"
- effort: "low" | "medium" | "high"
- priority: integer 1-8 (1 = most important)
- basedOn: which competitor advantage or gap this addresses

Focus on high-impact, low-effort tests first. Be specific about what to change and measure.`;

function extractJson(raw: string): string {
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function repairJson(str: string, maxPasses = 10): string {
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
      if (e.message.includes("Expected ','") || e.message.includes("after array element")) {
        current = current.slice(0, pos) + "," + current.slice(pos);
        continue;
      }
      if (current[pos] === '"') {
        current = current.slice(0, pos) + '\\"' + current.slice(pos + 1);
        continue;
      }
      throw e;
    }
  }
  return current;
}

function parseABTests(raw: string): ABTestSuggestion[] {
  const jsonStr = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const repaired = repairJson(jsonStr.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}"));
    parsed = JSON.parse(repaired);
  }

  if (!Array.isArray(parsed)) return [];

  return (parsed as Record<string, unknown>[])
    .filter(item => item && typeof item === "object")
    .map((item, idx) => ({
      testName: String(item.testName ?? `Test ${idx + 1}`),
      hypothesis: String(item.hypothesis ?? ""),
      control: String(item.control ?? ""),
      variant: String(item.variant ?? ""),
      metric: String(item.metric ?? ""),
      estimatedImpact: (["low", "medium", "high"].includes(String(item.estimatedImpact))
        ? item.estimatedImpact : "medium") as "low" | "medium" | "high",
      effort: (["low", "medium", "high"].includes(String(item.effort))
        ? item.effort : "medium") as "low" | "medium" | "high",
      priority: typeof item.priority === "number" ? item.priority : idx + 1,
      basedOn: String(item.basedOn ?? ""),
    }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 8);
}

/**
 * Generate A/B test suggestions from a site comparison using AI.
 * Returns [] if the AI call fails.
 */
export async function generateABTests(
  comparison: SiteComparison,
  businessCategory: string,
): Promise<ABTestSuggestion[]> {
  const userPrompt = `Business category: ${businessCategory}
Business name: ${comparison.businessName}
Competitor name: ${comparison.competitorName}

Competitor advantages (things competitor has that the business doesn't):
${comparison.disadvantages.length > 0 ? comparison.disadvantages.map(d => `- ${d}`).join("\n") : "- None identified"}

Business advantages:
${comparison.advantages.length > 0 ? comparison.advantages.map(a => `- ${a}`).join("\n") : "- None identified"}

Key differences:
- CTA count: Business ${comparison.ctaDiff.businessCtaCount} vs Competitor ${comparison.ctaDiff.competitorCtaCount}
- Business has above-fold CTA: ${comparison.ctaDiff.businessHasAboveFold}
- Competitor has above-fold CTA: ${comparison.ctaDiff.competitorHasAboveFold}
- Business has testimonials: ${comparison.contentDiff.businessHasTestimonials}
- Competitor has testimonials: ${comparison.contentDiff.competitorHasTestimonials}
- Business has video: ${comparison.contentDiff.businessHasVideo}
- Competitor has video: ${comparison.contentDiff.competitorHasVideo}
- Business has schema markup: ${comparison.seoDiff.businessHasSchema}
- Competitor has schema markup: ${comparison.seoDiff.competitorHasSchema}

Opportunities identified:
${comparison.opportunities.length > 0 ? comparison.opportunities.map(o => `- ${o}`).join("\n") : "- None identified"}

Generate 5-8 specific, prioritized A/B tests as a JSON array. Focus on high-impact changes first.`;

  try {
    const result = await generateCompletion(SYSTEM_PROMPT, userPrompt, { maxTokens: 3000 });
    return parseABTests(result.text);
  } catch (err) {
    console.error("[ab-tests] AI call failed:", err);
    return [];
  }
}
