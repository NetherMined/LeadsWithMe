// src/types/report.ts

export interface ScreenshotResult {
  url: string;
  pageTitle: string;
  screenshotBuffer: Buffer;
  screenshotBase64: string;
  viewport: { width: number; height: number };
  capturedAt: string;
}

export interface SiteAnalysis {
  url: string;

  // Structure
  navItemCount: number;
  hasHamburgerMenu: boolean;
  internalPageCount: number;
  hasFooterLinks: boolean;

  // Content
  heroHeadline: string | null;
  hasTestimonials: boolean;
  testimonialCount: number;
  hasVideo: boolean;
  hasPricing: boolean;
  hasBlog: boolean;
  wordCount: number;
  imageCount: number;

  // CTAs
  ctaCount: number;
  hasCtaAboveFold: boolean;
  hasFloatingCta: boolean;
  ctaTexts: string[];
  ctaPlacements: string[];

  // Design
  colorScheme: { primary: string | null; secondary: string | null; background: string | null };
  fontFamilies: string[];
  layoutType: "single-column" | "multi-column" | "grid" | "unknown";

  // Tech (subset for comparison)
  techStack: string[];
  hasAnalytics: boolean;
  analyticsTools: string[];
  hasChatWidget: boolean;

  // Performance
  loadTimeMs: number | null;

  // SEO
  hasSchemaMarkup: boolean;
  hasSitemap: boolean;
  hasOpenGraph: boolean;
  hasCanonical: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface ComparisonItem {
  label: string;
  business: string | boolean | number | null;
  competitor: string | boolean | number | null;
  winner: "business" | "competitor" | "tie";
  note: string | null;
}

export interface CtaDiff {
  businessCtaCount: number;
  competitorCtaCount: number;
  businessHasAboveFold: boolean;
  competitorHasAboveFold: boolean;
  businessHasFloating: boolean;
  competitorHasFloating: boolean;
}

export interface TechDiff {
  businessOnly: string[];
  competitorOnly: string[];
  shared: string[];
  businessAnalytics: string[];
  competitorAnalytics: string[];
}

export interface ContentDiff {
  businessHasTestimonials: boolean;
  competitorHasTestimonials: boolean;
  businessHasVideo: boolean;
  competitorHasVideo: boolean;
  businessHasPricing: boolean;
  competitorHasPricing: boolean;
  businessHasBlog: boolean;
  competitorHasBlog: boolean;
}

export interface DesignDiff {
  businessLayout: string;
  competitorLayout: string;
  businessFonts: string[];
  competitorFonts: string[];
}

export interface SeoDiff {
  businessHasSchema: boolean;
  competitorHasSchema: boolean;
  businessHasSitemap: boolean;
  competitorHasSitemap: boolean;
  businessHasOG: boolean;
  competitorHasOG: boolean;
}

export interface SiteComparison {
  businessName: string;
  competitorName: string;
  items: ComparisonItem[];
  advantages: string[];       // business has these, competitor doesn't
  disadvantages: string[];    // competitor has these, business doesn't
  opportunities: string[];    // derived improvement suggestions
  ctaDiff: CtaDiff;
  techDiff: TechDiff;
  contentDiff: ContentDiff;
  designDiff: DesignDiff;
  seoDiff: SeoDiff;
}

export interface ABTestSuggestion {
  testName: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  estimatedImpact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  priority: number;           // 1 = highest
  basedOn: string;            // what observation this is based on
}

export interface PDFReportData {
  profile: import("@/lib/db/queries").FullBusinessProfile;
  competitor: import("@/types/business").Business | null;
  comparison: SiteComparison | null;
  abTests: ABTestSuggestion[];
  bizScreenshots: ScreenshotResult[];
  compScreenshots: ScreenshotResult[];
}

export interface PDFReportResult {
  url: string;
  fileName: string;
  pages: number;
  includesCompetitor: boolean;
  abTestCount: number;
}
