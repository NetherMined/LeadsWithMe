import type { FullBusinessProfile } from "@/lib/db/queries";
import type { SocialChannelAudit } from "@/types/audit";

export function buildPlanPrompt(profile: FullBusinessProfile): { system: string; user: string } {
  const system = `You are a senior digital marketing strategist. You write actionable, specific marketing improvement plans for local businesses. Your recommendations are practical, budget-conscious, and prioritised by impact.

Be concise: keep each "description" under 60 words, each "estimated_impact" under 15 words. Aim for 3 items per section — no more than 4.
Never use double-quote characters inside string values — use single quotes or rephrase instead.

Always respond in valid JSON matching this exact schema (no markdown, no code blocks, raw JSON only):
{
  "executive_summary": "string (2-3 paragraphs)",
  "website_recommendations": {
    "title": "Website Improvements",
    "summary": "string",
    "items": [{"title":"string","description":"string","priority":"high|medium|low","effort":"quick_win|medium|strategic","estimated_impact":"string"}]
  },
  "social_recommendations": {
    "title": "Social Media Strategy",
    "summary": "string",
    "items": [{"title":"string","description":"string","priority":"high|medium|low","effort":"quick_win|medium|strategic","estimated_impact":"string"}]
  },
  "advertising_recommendations": {
    "title": "Advertising Roadmap",
    "summary": "string",
    "items": [{"title":"string","description":"string","priority":"high|medium|low","effort":"quick_win|medium|strategic","estimated_impact":"string"}]
  },
  "quick_wins": [{"title":"string","description":"string","priority":"high","effort":"quick_win","estimated_impact":"string"}],
  "medium_term": [{"title":"string","description":"string","priority":"medium","effort":"medium","estimated_impact":"string"}],
  "long_term": [{"title":"string","description":"string","priority":"low","effort":"strategic","estimated_impact":"string"}],
  "outreach_email_draft": "string (cold email introducing findings to business owner)"
}`;

  const channels = (profile.socialAudit?.channels as SocialChannelAudit[] | undefined) ?? [];

  const user = `Generate a marketing improvement plan for this business:

BUSINESS: ${profile.business.name}
CATEGORY: ${profile.business.category}
LOCATION: ${profile.business.address}
RATING: ${profile.business.rating ?? "No rating"}/5 (${profile.business.review_count} reviews)

WEBSITE AUDIT:
- URL: ${profile.business.website ?? "NO WEBSITE"}
- Performance: ${profile.websiteAudit?.performance_score ?? "Not tested"}/100
- SEO: ${profile.websiteAudit?.seo_score ?? "Not tested"}/100
- Accessibility: ${profile.websiteAudit?.accessibility_score ?? "Not tested"}/100
- Mobile Friendly: ${profile.websiteAudit?.mobile_friendly ?? "Unknown"}
- SSL: ${profile.websiteAudit?.has_ssl ?? "Unknown"}
- Analytics Installed: ${profile.websiteAudit?.has_analytics ?? "Unknown"}
- CMS: ${profile.websiteAudit?.cms_detected ?? "Unknown"}
- Has Blog: ${profile.websiteAudit?.has_blog ?? "Unknown"}
- Blog Last Post: ${profile.websiteAudit?.blog_last_post_date ?? "Unknown"}
- Page Speed: ${profile.websiteAudit?.page_speed_ms ?? "Unknown"}ms

SOCIAL MEDIA:
${channels.length > 0
  ? channels.map(c =>
      `- ${c.platform}: ${c.exists ? "Active" : "Not found"}, Followers: ${c.follower_count ?? "Unknown"}, Bio: ${c.bio_complete ? "Complete" : "Incomplete"}`
    ).join("\n")
  : "No social media links detected"}
Missing platforms: ${profile.socialAudit?.missing_platforms?.join(", ") ?? "Analysis pending"}

ADVERTISING:
- Meta/Facebook Ads: ${profile.adsAudit?.has_meta_ads ? `Yes (${profile.adsAudit.meta_ad_count} active)` : "No"}
- Google Ads: ${profile.adsAudit?.has_google_ads ? "Detected" : "Not detected"}
- Domain Authority: ${profile.adsAudit?.domain_authority ?? "Unknown"}/100

DIGITAL PRESENCE SCORE: ${profile.score?.total_score ?? "Not calculated"}/100 (Grade: ${profile.score?.grade ?? "?"} — ${profile.score?.label ?? ""})

Generate a specific, actionable plan. Reference actual data points above. Be direct and practical. Minimum 3 items per section.`;

  return { system, user };
}
