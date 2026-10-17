import "server-only";
import { generateCompletion } from "@/lib/ai/client";
import type { Business, SocialLinks, WebResult } from "@/types/business";
import type { WebsiteAudit } from "@/types/audit";
import type { DigitalPresenceScore } from "@/types/score";

export interface ProposalInput {
  business: Business;
  websiteAudit?: WebsiteAudit | null;
  score?: DigitalPresenceScore | null;
}

export interface GeneratedProposal {
  markdown: string;
  filename: string;
  model: string;
}

async function findCompetitorWebsites(
  businessName: string,
  category: string,
  city: string
): Promise<Array<{ name: string; url: string; description: string }>> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const q = encodeURIComponent(`${category} ${city} website`);
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=10`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description?: string; meta_url?: { hostname?: string } }> } };
    const results = data.web?.results ?? [];

    // Filter: exclude directories, social media, and the business itself
    const BLOCKED = new Set(["yelp.com", "yellowpages.com", "facebook.com", "instagram.com", "tripadvisor.com", "google.com", "linkedin.com"]);
    const competitors: Array<{ name: string; url: string; description: string }> = [];

    for (const r of results) {
      const domain = r.meta_url?.hostname ?? "";
      const isBlocked = [...BLOCKED].some(d => domain.includes(d));
      const isSelf = r.title.toLowerCase().includes(businessName.toLowerCase());
      if (!isBlocked && !isSelf && r.url.startsWith("http")) {
        competitors.push({
          name: r.title.split(" - ")[0].split(" | ")[0].trim(),
          url: r.url,
          description: r.description ?? "",
        });
        if (competitors.length >= 5) break;
      }
    }
    return competitors;
  } catch {
    return [];
  }
}

/** What the audit found wrong with an existing site, for the redesign variant of the prompt. */
function currentSiteSummary(website: string, audit: WebsiteAudit | null | undefined, score: DigitalPresenceScore | null | undefined): string {
  if (!audit) return `- URL: ${website}\n- Not audited yet; infer improvements from the category and competitors.`;
  const lines = [
    `- URL: ${website}`,
    `- PageSpeed (mobile): performance ${audit.performance_score}/100, SEO ${audit.seo_score}/100, accessibility ${audit.accessibility_score}/100`,
    `- Mobile friendly: ${audit.mobile_friendly ? "yes" : "no"}; SSL: ${audit.has_ssl ? "yes" : "no"}; analytics: ${audit.has_analytics ? "yes" : "no"}`,
    `- CMS: ${audit.cms_detected ?? "unknown"}; blog: ${audit.has_blog ? `yes (last post ${audit.blog_last_post_date ?? "unknown"})` : "no"}`,
    `- Meta title: ${audit.meta_title ?? "missing"}; meta description: ${audit.meta_description ? "present" : "missing"}; structured data: ${audit.structured_data ? "yes" : "no"}`,
    `- Chat widget: ${audit.has_chat_widget ? "yes" : "no"}; visible specials/deals: ${audit.has_deals ? "yes" : "no"}`,
  ];
  if (score) lines.push(`- Overall digital presence score: ${score.total_score}/100 (grade ${score.grade}); website sub-score ${score.website_score}/100`);
  return lines.join("\n");
}

export function proposalFilename(businessName: string): string {
  return `${businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-website-proposal.md`;
}

/**
 * Writes a Markdown website proposal. Businesses without a website get a new-site proposal;
 * businesses with one get a redesign proposal grounded in their website audit.
 */
export async function generateWebsiteProposal({ business: biz, websiteAudit, score }: ProposalInput): Promise<GeneratedProposal> {
  const city = biz.address_city ?? biz.address?.split(",").slice(-2, -1)[0]?.trim() ?? "";
  const competitors = await findCompetitorWebsites(biz.name, biz.category, city);
  const isRedesign = Boolean(biz.website);

  const socials = biz.social_links as SocialLinks ?? {};
  const socialSummary = Object.entries(socials)
    .filter(([, url]) => !!url)
    .map(([platform, url]) => `- ${platform}: ${url}`)
    .join("\n") || "No social media profiles found.";

  const webContext = ((biz.web_results ?? []) as WebResult[])
    .slice(0, 5)
    .map(r => `- ${r.source}: ${r.snippet ?? ""}`)
    .join("\n") || "No web results available.";

  const competitorContext = competitors.length > 0
    ? competitors.map(c => `- ${c.name} (${c.url}): ${c.description}`).join("\n")
    : "No competitor websites found via search.";

  const systemPrompt = `You are a professional web design consultant and digital strategist specializing in small business websites.
Generate detailed, actionable website proposal documents in Markdown format.
Be specific, practical, and tailored to the business category and location.
Use concrete examples, real design suggestions, and specific content recommendations.`;

  const situation = isRedesign
    ? `Generate a comprehensive website REDESIGN proposal for the following business. It already has a website; the proposal must explain what is holding the current site back (use the audit findings below) and how the new site fixes each problem.`
    : `Generate a comprehensive website proposal document for the following business that currently has NO website.`;

  const currentSite = isRedesign
    ? `\n## Current Website (audit findings)\n${currentSiteSummary(biz.website!, websiteAudit, score)}\n`
    : "";

  const summaryHint = isRedesign
    ? "Brief overview of what the current site costs the business and the recommended redesign (2-3 paragraphs)."
    : "Brief overview of the opportunity and recommended approach (2-3 paragraphs).";

  const brandHint = isRedesign
    ? `Based on the current site, social media presence and business category, describe:
- Current brand impression and what to keep or change
- Target audience profile
- Key differentiators to highlight`
    : `Based on social media presence and business category, describe:
- Inferred brand personality and tone
- Target audience profile
- Key differentiators to highlight`;

  const userPrompt = `${situation}

## Business Details
- **Name**: ${biz.name}
- **Category**: ${biz.category}
- **Address**: ${biz.address ?? "Not provided"}
- **City**: ${city}
- **Phone**: ${biz.phone ?? "Not provided"}
- **Rating**: ${biz.rating ?? "N/A"} (${biz.review_count ?? 0} reviews)
- **Description**: ${biz.description ?? "Not provided"}
${currentSite}
## Current Social Media Presence
${socialSummary}

## Web Presence Found Online
${webContext}

## Competitor Websites (same category in area)
${competitorContext}

---

Create a detailed website proposal in Markdown format with these sections:

# Website ${isRedesign ? "Redesign " : ""}Proposal: [Business Name]

## 1. Executive Summary
${summaryHint}

## 2. Brand Identity Analysis
${brandHint}

## 3. Competitor Analysis
For each competitor found, analyze:
- What they do well on their website
- Gaps you can exploit
- Design patterns worth referencing

## 4. Proposed Website Structure
List pages and key sections for each page:
- Homepage (sections: hero, services, about, testimonials, contact)
- [Other relevant pages for this business type]

## 5. Content Brief
For each page, specify:
- Headline copy suggestions
- Key messages to communicate
- Photo/media requirements
- Call-to-action text

## 6. Design Direction
- Color palette (3 colors with hex codes, justified by brand/category)
- Typography suggestions (heading font, body font)
- Visual style (photography style, icon style, layout mood)
- Mobile-first considerations

## 7. Technical Recommendations
- Recommended platform (e.g., Next.js, Webflow, WordPress — justify choice)
- Essential features (contact form, booking, gallery, etc.)
- SEO foundation (title tags, local SEO, Google Business integration)
- Performance targets

## 8. AI Build Prompt
A ready-to-paste prompt for building this site with an AI coding tool (Cursor/Claude/Bolt):

\`\`\`
[Complete AI prompt that includes: business details, design spec, page structure, tech stack, and specific requirements to build a demo website]
\`\`\`

## 9. Next Steps
Numbered action list for getting started.`;

  const result = await generateCompletion(systemPrompt, userPrompt, { maxTokens: 3000 });
  // Providers sometimes answer with an error notice (e.g. out of credits) instead of a proposal.
  const sections = result.text.match(/^#{1,3}\s/gm)?.length ?? 0;
  if (result.text.length < 1500 || sections < 3) {
    throw new Error(`AI did not return a usable proposal: ${result.text.slice(0, 160).trim()}`);
  }
  return { markdown: result.text, filename: proposalFilename(biz.name), model: result.model };
}
