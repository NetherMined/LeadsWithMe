import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { runPageSpeedAudit, runSeoScan, detectTechStack, checkContentFreshness, detectDealsAndSpecials } from "@/lib/scraper/website";
import { searchExternalDeals } from "@/lib/scraper/deals";
import { trackApiUsage } from "@/lib/usage/track";
import { getBusinessById, upsertWebsiteAudit } from "@/lib/db/queries";

const schema = z.object({ business_id: z.string().uuid() });

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

    if (!business.website) {
      return NextResponse.json({ error: "Business has no website" }, { status: 400 });
    }

    const url = business.website;

    // Fetch HTML once
    let html = "";
    let headers = new Headers();
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadSightBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      html = await res.text();
      headers = res.headers;
    } catch { /* partial result */ }

    // Track pagespeed call
    trackApiUsage({ userId: user.id, service: "pagespeed", operation: "pagespeed" });

    // Run all checks in parallel
    const [pageSpeed, seoScan, techStack, freshness, externalDeals] = await Promise.all([
      runPageSpeedAudit(url),
      runSeoScan(url, html),
      detectTechStack(url, html, headers),
      checkContentFreshness(url, html),
      searchExternalDeals(business.name as string, business.address_city as string | null),
    ]);
    const deals = detectDealsAndSpecials(url, html);

    // Extract emails from HTML for contact_emails field
    const emailMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)];
    const contactEmails = [...new Set(emailMatches.map(m => m[1].toLowerCase()))].slice(0, 10);

    // Extract meta title and description
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaTitle = titleMatch?.[1]?.trim() ?? null;
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDescription = metaDescMatch?.[1]?.trim() ?? null;

    const auditData = {
      business_id,
      performance_score: pageSpeed.performanceScore,
      seo_score: Math.round((pageSpeed.seoScore + seoScan.score) / 2),
      accessibility_score: pageSpeed.accessibilityScore,
      mobile_friendly: techStack.hasMobileViewport,
      mobile_viewport: techStack.hasMobileViewport,
      has_ssl: techStack.hasSSL,
      has_analytics: techStack.hasAnalytics,
      cms_detected: techStack.cms,
      page_speed_ms: pageSpeed.firstContentfulPaint,
      meta_title: metaTitle,
      meta_description: metaDescription,
      og_image: seoScan.ogImage,
      h1_count: seoScan.h1Count,
      has_sitemap: seoScan.hasSitemap,
      has_robots_txt: seoScan.hasRobots,
      structured_data: seoScan.hasStructuredData,
      canonical_url: seoScan.canonicalUrl,
      open_graph_tags: seoScan.hasOpenGraph,
      has_blog: freshness.hasBlog,
      blog_last_post_date: freshness.lastPostDate,
      tech_stack: techStack.techStack,
      tech_stack_detailed: techStack.techStackDetailed,
      external_deals: externalDeals,
      has_deals: deals.has_deals,
      deals_keywords: deals.deals_keywords,
      has_chat_widget: techStack.hasChatWidget,
      has_cookie_consent: techStack.hasCookieConsent,
      contact_emails: contactEmails,
    };

    const audit = await upsertWebsiteAudit(auditData);

    return NextResponse.json({ audit, seoIssues: seoScan.issues });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Website audit error:", error);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
