import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { generateCompletion } from "@/lib/ai/client";
import { getBusinessById } from "@/lib/db/queries";
import type { Business, SocialLinks, WebResult } from "@/types/business";

export const maxDuration = 240;

const schema = z.object({ business_id: z.string().uuid() });

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getBusinessById(business_id, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as Business & { address_city: string | null };

    // Find competitor websites
    const city = biz.address_city ?? biz.address?.split(",").slice(-2, -1)[0]?.trim() ?? "";
    const competitors = await findCompetitorWebsites(biz.name, biz.category, city);

    // Build social presence summary
    const socials = biz.social_links as SocialLinks ?? {};
    const socialSummary = Object.entries(socials)
      .filter(([, url]) => !!url)
      .map(([platform, url]) => `- ${platform}: ${url}`)
      .join("\n") || "No social media profiles found.";

    // Build web results context
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

    const userPrompt = `Generate a comprehensive website proposal document for the following business that currently has NO website.

## Business Details
- **Name**: ${biz.name}
- **Category**: ${biz.category}
- **Address**: ${biz.address ?? "Not provided"}
- **City**: ${city}
- **Phone**: ${biz.phone ?? "Not provided"}
- **Rating**: ${biz.rating ?? "N/A"} (${biz.review_count ?? 0} reviews)
- **Description**: ${biz.description ?? "Not provided"}

## Current Social Media Presence
${socialSummary}

## Web Presence Found Online
${webContext}

## Competitor Websites (same category in area)
${competitorContext}

---

Create a detailed website proposal in Markdown format with these sections:

# Website Proposal: [Business Name]

## 1. Executive Summary
Brief overview of the opportunity and recommended approach (2-3 paragraphs).

## 2. Brand Identity Analysis
Based on social media presence and business category, describe:
- Inferred brand personality and tone
- Target audience profile
- Key differentiators to highlight

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

    const filename = `${biz.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-website-proposal.md`;

    return NextResponse.json({ markdown: result.text, filename });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    console.error("[WebsiteProposal] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}
