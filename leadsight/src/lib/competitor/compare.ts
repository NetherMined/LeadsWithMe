// src/lib/competitor/compare.ts
import type {
  SiteAnalysis,
  SiteComparison,
  ComparisonItem,
  CtaDiff,
  TechDiff,
  ContentDiff,
  DesignDiff,
  SeoDiff,
} from "@/types/report";

function boolItem(
  label: string,
  biz: boolean,
  comp: boolean,
  noteIfBizWins?: string,
  noteIfCompWins?: string,
): ComparisonItem {
  const winner = biz === comp ? "tie" : biz ? "business" : "competitor";
  return {
    label,
    business: biz,
    competitor: comp,
    winner,
    note: winner === "business" ? (noteIfBizWins ?? null) : winner === "competitor" ? (noteIfCompWins ?? null) : null,
  };
}

function numItem(
  label: string,
  biz: number,
  comp: number,
  higherIsBetter = true,
  note: string | null = null,
): ComparisonItem {
  const bizWins = higherIsBetter ? biz > comp : biz < comp;
  const compWins = higherIsBetter ? comp > biz : comp < biz;
  return {
    label,
    business: biz,
    competitor: comp,
    winner: bizWins ? "business" : compWins ? "competitor" : "tie",
    note,
  };
}

/**
 * Pure sync comparison of two SiteAnalysis objects.
 */
export function compareSites(
  biz: SiteAnalysis,
  comp: SiteAnalysis,
  bizName: string,
  compName: string,
): SiteComparison {
  // --- Comparison items table ---
  const items: ComparisonItem[] = [
    // CTAs
    numItem("CTA Count", biz.ctaCount, comp.ctaCount, true, "More CTAs typically = more conversion paths"),
    boolItem("CTA Above Fold", biz.hasCtaAboveFold, comp.hasCtaAboveFold, undefined, "Competitor's above-fold CTA likely captures more visitors"),
    boolItem("Floating CTA", biz.hasFloatingCta, comp.hasFloatingCta),

    // Content
    boolItem("Testimonials", biz.hasTestimonials, comp.hasTestimonials, undefined, "Social proof missing — competitor has an edge"),
    boolItem("Video Content", biz.hasVideo, comp.hasVideo),
    boolItem("Pricing Page", biz.hasPricing, comp.hasPricing),
    boolItem("Blog / News", biz.hasBlog, comp.hasBlog),
    numItem("Word Count", biz.wordCount, comp.wordCount, true, "More content aids SEO and trust"),
    numItem("Images", biz.imageCount, comp.imageCount, true),

    // Performance
    numItem(
      "Load Time (ms)",
      biz.loadTimeMs ?? 0,
      comp.loadTimeMs ?? 0,
      false, // lower is better
      "Faster load time improves conversions",
    ),

    // Tech
    boolItem("Analytics Tracking", biz.hasAnalytics, comp.hasAnalytics, undefined, "Competitor tracks data — you don't"),
    boolItem("Chat Widget", biz.hasChatWidget, comp.hasChatWidget),

    // SEO
    boolItem("Schema Markup", biz.hasSchemaMarkup, comp.hasSchemaMarkup, undefined, "Schema helps rich snippets in Google"),
    boolItem("Sitemap", biz.hasSitemap, comp.hasSitemap),
    boolItem("Open Graph Tags", biz.hasOpenGraph, comp.hasOpenGraph),
    boolItem("Canonical URL", biz.hasCanonical, comp.hasCanonical),

    // Structure
    numItem("Navigation Links", biz.navItemCount, comp.navItemCount, true),
    boolItem("Footer Links", biz.hasFooterLinks, comp.hasFooterLinks),
    numItem("Internal Pages", biz.internalPageCount, comp.internalPageCount, true),
  ];

  // --- Advantages: biz has, comp doesn't ---
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  const opportunities: string[] = [];

  for (const item of items) {
    if (item.winner === "business" && typeof item.business === "boolean" && item.business) {
      advantages.push(item.label);
    } else if (item.winner === "competitor" && typeof item.business === "boolean" && !item.business) {
      disadvantages.push(item.label);
      // Turn each disadvantage into an opportunity
      opportunities.push(`Add ${item.label.toLowerCase()} to match or surpass ${compName}`);
    }
  }

  // CTA opportunities
  if (comp.ctaCount > biz.ctaCount + 2) {
    opportunities.push(`Increase CTAs (competitor has ${comp.ctaCount} vs your ${biz.ctaCount})`);
  }
  if (!biz.hasCtaAboveFold && comp.hasCtaAboveFold) {
    opportunities.push("Add a prominent CTA in the hero section (above the fold)");
  }
  if ((comp.loadTimeMs ?? 99999) < (biz.loadTimeMs ?? 0) * 0.7) {
    opportunities.push(`Improve page load time — competitor loads ${Math.round((biz.loadTimeMs ?? 0) - (comp.loadTimeMs ?? 0))}ms faster`);
  }

  // --- Diffs ---
  const bizTechSet = new Set(biz.techStack);
  const compTechSet = new Set(comp.techStack);

  const ctaDiff: CtaDiff = {
    businessCtaCount: biz.ctaCount,
    competitorCtaCount: comp.ctaCount,
    businessHasAboveFold: biz.hasCtaAboveFold,
    competitorHasAboveFold: comp.hasCtaAboveFold,
    businessHasFloating: biz.hasFloatingCta,
    competitorHasFloating: comp.hasFloatingCta,
  };

  const techDiff: TechDiff = {
    businessOnly: biz.techStack.filter(t => !compTechSet.has(t)),
    competitorOnly: comp.techStack.filter(t => !bizTechSet.has(t)),
    shared: biz.techStack.filter(t => compTechSet.has(t)),
    businessAnalytics: biz.analyticsTools,
    competitorAnalytics: comp.analyticsTools,
  };

  const contentDiff: ContentDiff = {
    businessHasTestimonials: biz.hasTestimonials,
    competitorHasTestimonials: comp.hasTestimonials,
    businessHasVideo: biz.hasVideo,
    competitorHasVideo: comp.hasVideo,
    businessHasPricing: biz.hasPricing,
    competitorHasPricing: comp.hasPricing,
    businessHasBlog: biz.hasBlog,
    competitorHasBlog: comp.hasBlog,
  };

  const designDiff: DesignDiff = {
    businessLayout: biz.layoutType,
    competitorLayout: comp.layoutType,
    businessFonts: biz.fontFamilies,
    competitorFonts: comp.fontFamilies,
  };

  const seoDiff: SeoDiff = {
    businessHasSchema: biz.hasSchemaMarkup,
    competitorHasSchema: comp.hasSchemaMarkup,
    businessHasSitemap: biz.hasSitemap,
    competitorHasSitemap: comp.hasSitemap,
    businessHasOG: biz.hasOpenGraph,
    competitorHasOG: comp.hasOpenGraph,
  };

  return {
    businessName: bizName,
    competitorName: compName,
    items,
    advantages,
    disadvantages,
    opportunities,
    ctaDiff,
    techDiff,
    contentDiff,
    designDiff,
    seoDiff,
  };
}
