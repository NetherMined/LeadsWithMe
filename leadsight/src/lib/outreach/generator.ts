import { generateCompletion } from "@/lib/ai/client";
import { parsePlanResponse } from "@/lib/ai/parser";
import { DEFAULT_POSITIONING, CURRENCY_SYMBOLS } from "./positioning";
import { getFallbackTemplate } from "./templates";
import type { OutreachAssets, IdentifiedIssue, OutreachGenerationInput } from "@/types/outreach";

// Issue severity order for deterministic ranking
type IssueSeverity = "critical" | "high" | "medium" | "low";

const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low"];

interface AuditData {
  website?: {
    performance_score?: number | null;
    is_mobile_friendly?: boolean | null;
    has_ssl?: boolean | null;
    has_chat_widget?: boolean | null;
    meta_description?: string | null;
    days_since_update?: number | null;
  } | null;
  social?: { platform_coverage_score?: number | null } | null;
  ads?: { has_meta_ads?: boolean | null; has_google_ads?: boolean | null } | null;
}

export function rankIssues(audits: AuditData): IdentifiedIssue[] {
  const issues: IdentifiedIssue[] = [];

  if (audits.website?.has_ssl === false) {
    issues.push({
      type: "trust",
      severity: "critical",
      description: "no SSL certificate — browsers show a security warning",
      fix_estimate: "included",
    });
  }
  if ((audits.website?.performance_score ?? 100) < 50) {
    issues.push({
      type: "speed",
      severity: "high",
      description: `slow page load (score: ${audits.website?.performance_score ?? "unknown"}/100) — visitors leave before seeing your services`,
      fix_estimate: "included",
    });
  }
  if (audits.website?.is_mobile_friendly === false) {
    issues.push({
      type: "mobile",
      severity: "high",
      description: "not mobile-friendly — most of your customers are on phones",
      fix_estimate: "included",
    });
  }
  if (audits.website?.has_chat_widget === false) {
    issues.push({
      type: "conversion",
      severity: "medium",
      description: "no contact form or chat widget — visitors have no easy way to reach you",
      fix_estimate: "included",
    });
  }
  if (!audits.website?.meta_description || (audits.website.meta_description?.length ?? 0) < 120) {
    issues.push({
      type: "seo",
      severity: "medium",
      description: "missing or short meta description — hurts search engine visibility",
      fix_estimate: "included",
    });
  }
  if ((audits.website?.days_since_update ?? 0) > 365) {
    issues.push({
      type: "freshness",
      severity: "low",
      description: "website content not updated in over a year",
      fix_estimate: "included",
    });
  }

  // Sort by severity, take top 3
  return issues
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 3);
}

export function buildOutreachPrompt(
  businessName: string,
  city: string,
  category: string,
  issues: IdentifiedIssue[],
  positioning: string,
  feeAmount: number,
  feeCurrency: string,
  deliveryDays: number
): string {
  const symbol = CURRENCY_SYMBOLS[feeCurrency] ?? feeCurrency;
  const issueList = issues.map((i, idx) => `Issue ${idx + 1} (${i.severity}): ${i.description}`).join("\n");

  return `You are writing cold outreach for a freelance web developer using the "${positioning}" positioning.

Business: ${businessName}
Location: ${city}
Category: ${category}
Fee: ${symbol}${feeAmount}
Delivery: ${deliveryDays} working days
No contracts.

CONFIRMED ISSUES (do not invent any others):
${issueList}

Write a complete outreach asset package. Output ONLY valid JSON matching this exact schema:
{
  "loom_script": {
    "hook": "10-second hook that references a specific issue",
    "problem_1": "25-second explanation of issue 1 in plain language",
    "problem_2": "25-second explanation of issue 2 in plain language",
    "close": "25-second offer with exact fee, delivery days, no-contract promise"
  },
  "email_subject": "subject line under 60 chars",
  "email_body": "plain markdown, maximum 90 words, must mention the fee",
  "linkedin_connect_note": "under 280 characters",
  "linkedin_followup": "post-accept message with placeholder [LOOM_URL]"
}

RULES:
- Never use technical jargon (no Core Web Vitals, LCP, CLS, etc.)
- Use phrases like "losing enquiries", "customers can't find you", "phone not ringing"
- Currency: always use ${symbol} symbol, never a different currency symbol
- No fake urgency phrases ("act now", "limited time")
- Concrete deadline: "done by [day of week]" or "done in ${deliveryDays} working days"
- Tone: direct, addressing a busy owner who gets 20 cold emails a day`;
}

export async function generateOutreachAssets(input: OutreachGenerationInput): Promise<OutreachAssets> {
  const {
    businessName,
    city,
    category,
    audits,
    positioning = DEFAULT_POSITIONING.service_label,
    feeAmount = DEFAULT_POSITIONING.fee_range.min,
    feeCurrency = DEFAULT_POSITIONING.fee_range.currency,
    deliveryDays = DEFAULT_POSITIONING.delivery_days,
  } = input;

  const issues = rankIssues(audits);

  if (issues.length === 0) {
    // Business has no detectable issues — not a good outreach target
    throw new Error("No actionable issues found for this business");
  }

  const prompt = buildOutreachPrompt(businessName, city, category, issues, positioning, feeAmount, feeCurrency, deliveryDays);

  try {
    const result = await generateCompletion(prompt, "", { maxTokens: 1200 });
    const parsed = parseOutreachResponse(result.text);
    return { ...parsed, identified_issues: issues };
  } catch {
    // Fallback to hardcoded template
    return getFallbackTemplate(businessName, city, issues, feeAmount, feeCurrency, deliveryDays);
  }
}

function parseOutreachResponse(raw: string): Omit<OutreachAssets, "identified_issues"> {
  // Extract JSON block
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Apply same repair logic as plan parser — fix literal newlines in strings
    const repaired = jsonMatch[0].replace(/(?<=":[\s]*"[^"]*)\n(?=[^"]*")/g, "\\n");
    return JSON.parse(repaired);
  }
}
