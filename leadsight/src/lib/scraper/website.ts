import * as cheerio from "cheerio";
import type { SocialLinks } from "@/types/business";
import type { TechStackDetailed } from "@/types/audit";
import { safeFetch } from "@/lib/net/safe-fetch";

export interface WebsiteEnrichment {
  socialLinks: SocialLinks;
  metaTitle: string | null;
  metaDescription: string | null;
  technologies: string[];
  contactEmail: string | null;
  emails: string[];
  mobiles: string[];
  whatsapp: string | null;
}

export const SOCIAL_PATTERNS = {
  facebook: /facebook\.com\/(?!sharer|share|login|dialog)[a-zA-Z0-9._%-]+/,
  instagram: /instagram\.com\/[a-zA-Z0-9._-]+/,
  linkedin: /linkedin\.com\/(company|in)\/[a-zA-Z0-9._-]+/,
  tiktok: /tiktok\.com\/@[a-zA-Z0-9._-]+/,
  twitter: /(twitter|x)\.com\/[a-zA-Z0-9._-]+/,
  youtube: /youtube\.com\/(c\/|channel\/|@)[a-zA-Z0-9._-]+/,
};

const TECH_PATTERNS: Record<keyof TechStackDetailed, Record<string, string>> = {
  platforms: {
    WordPress:    "wp-content|wp-includes|wordpress",
    Shopify:      "cdn\\.shopify",
    Wix:          "wixstatic\\.com|wix\\.com",
    Squarespace:  "squarespace\\.com",
    Webflow:      "webflow\\.com",
    Joomla:       "/components/com_|joomla",
    Drupal:       "drupal\\.js|sites/default/files",
    Magento:      "mage/|magento",
    BigCommerce:  "bigcommerce\\.com|cdn11\\.bigcommerce",
    PrestaShop:   "prestashop",
    Ghost:        "ghost\\.io|content/images/size/",
    "Next.js":    "__next|_next/static",
    Nuxt:         "__nuxt|_nuxt/",
    Gatsby:       "gatsby-|___gatsby",
  },
  analytics: {
    "Google Analytics": "gtag\\(|google-analytics\\.com/analytics|ga\\('send'",
    "Google Tag Manager": "googletagmanager\\.com/gtm",
    Hotjar:       "hotjar\\.com|hjid",
    Mixpanel:     "mixpanel\\.com|mixpanel\\.track",
    Amplitude:    "amplitude\\.com|amplitude\\.getInstance",
    Heap:         "heap\\.io|heap\\.track",
    Plausible:    "plausible\\.io",
    Matomo:       "matomo\\.js|piwik\\.js",
    Segment:      "segment\\.io|analytics\\.js",
    "Microsoft Clarity": "clarity\\.ms|ms\\.clarity",
  },
  advertising: {
    "Google Ads":       "googleadservices\\.com|gtag.*AW-",
    "Meta Pixel":       "fbq\\(|facebook\\.net/en_US/fbevents",
    "LinkedIn Insight": "snap\\.licdn\\.com|linkedin\\.com/insight",
    "Twitter/X Pixel":  "static\\.ads-twitter\\.com|twq\\(",
    "TikTok Pixel":     "analytics\\.tiktok\\.com|ttq\\.",
    "Pinterest Tag":    "ct\\.pinterest\\.com|pintrk\\(",
  },
  payment: {
    Stripe:    "js\\.stripe\\.com|stripe\\.com/v3",
    PayPal:    "paypal\\.com/sdk|paypalobjects\\.com",
    Square:    "squareup\\.com|square\\.js",
    Klarna:    "klarna\\.com|klarna-payments",
    Afterpay:  "afterpay\\.com|afterpay\\.js",
  },
  email_marketing: {
    Mailchimp:      "chimpstatic\\.com|mailchimp\\.com",
    Klaviyo:        "klaviyo\\.com|klaviyo-bi\\.js",
    HubSpot:        "hs-scripts\\.com|hubspot\\.com",
    ActiveCampaign: "trackcmp\\.net|activecampaign\\.com",
    Brevo:          "sibautomation\\.com|brevo\\.com",
    ConvertKit:     "convertkit\\.com|ck\\.js",
  },
  customer_support: {
    Intercom: "intercom\\.io|intercomcdn",
    Drift:    "drift\\.com|driftt\\.com",
    "Tawk.to": "tawk\\.to",
    Tidio:    "tidio\\.co|tidiochat",
    Crisp:    "crisp\\.chat",
    Zendesk:  "zendesk\\.com|zdassets\\.com",
    Freshdesk:"freshdesk\\.com|freshworks\\.com",
    LiveChat: "livechat\\.com|cdn\\.livechatinc",
  },
  hosting_cdn: {
    Cloudflare:    "cloudflare\\.com|__cf_bm|cf-ray",
    "AWS CloudFront": "cloudfront\\.net",
    Fastly:        "fastly\\.net",
    Vercel:        "vercel\\.app|x-vercel",
    Netlify:       "netlify\\.app|netlify\\.com",
    Akamai:        "akamaized\\.net|akamai",
  },
  social_proof: {
    Trustpilot:           "trustpilot\\.com|tp-widget",
    Yotpo:                "yotpo\\.com|yotpo-widget",
    "Judge.me":           "judge\\.me|judgeme",
    "Google Reviews widget": "place_id.*review|google.*review.*widget",
  },
  booking: {
    Calendly:    "calendly\\.com",
    Acuity:      "acuityscheduling\\.com",
    SimplyBook:  "simplybook\\.me",
  },
};

// Keep for backward compat in enrichWebsite()
const CMS_PATTERNS: Record<string, string> = {
  wordpress: "wp-content|wp-includes|wordpress",
  shopify: "cdn.shopify",
  wix: "wixstatic.com|wix.com",
  squarespace: "squarespace.com",
  webflow: "webflow.com",
};

// Detect mobile numbers from tel: links (international format)
export function extractMobiles(html: string): string[] {
  const found = new Set<string>();
  // tel: href numbers
  const telMatches = html.matchAll(/href="tel:([+\d\s\-().]+)"/gi);
  for (const m of telMatches) {
    const num = m[1].replace(/[\s\-().]/g, "");
    // Heuristic: mobile numbers often start with +27 6/7/8, +1 on 10-digit, etc.
    // Keep any tel: number that looks like a mobile (7+ digits)
    if (num.replace(/\D/g, "").length >= 7) found.add(m[1].trim());
  }
  // Plain mobile patterns: sequences like 07x, 08x (SA), 01x (UK mobile), etc.
  const plainMatches = html.matchAll(/\b(0[67]\d[\s\-]?\d{3}[\s\-]?\d{4})\b/g);
  for (const m of plainMatches) found.add(m[1].trim());
  return [...found].slice(0, 5);
}

// Extract all unique emails from HTML
export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  const mailtoMatches = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
  for (const m of mailtoMatches) found.add(m[1].toLowerCase());
  // Also scan plain text for emails (limited to avoid false positives)
  const plainMatches = html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g);
  for (const m of plainMatches) {
    const email = m[1].toLowerCase();
    // Skip common tracking/asset domains
    if (!email.includes("sentry") && !email.includes("example") && !email.includes("wixpress") && !email.includes("squarespace")) {
      found.add(email);
    }
  }
  return [...found].slice(0, 10);
}

// Detect WhatsApp link
export function extractWhatsApp(html: string): string | null {
  const m = html.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send[?][^"'\s]*phone=)(\+?[\d]+)/i)
    || html.match(/wa\.me\/(\+?[\d]+)/i);
  if (m) return `https://wa.me/${m[1].replace(/\D/g, "")}`;
  return null;
}

export async function enrichWebsite(url: string): Promise<WebsiteEnrichment> {
  const defaultResult: WebsiteEnrichment = {
    socialLinks: { facebook: null, instagram: null, linkedin: null, tiktok: null, twitter: null, youtube: null },
    metaTitle: null,
    metaDescription: null,
    technologies: [],
    contactEmail: null,
    emails: [],
    mobiles: [],
    whatsapp: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return defaultResult;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract social links — check <a> tags, JSON-LD sameAs, meta tags, and raw HTML
    const socialLinks: SocialLinks = { facebook: null, instagram: null, linkedin: null, tiktok: null, twitter: null, youtube: null };

    function applySocialUrl(raw: string) {
      const href = raw.trim();
      for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
        if (pattern.test(href) && !socialLinks[platform as keyof SocialLinks]) {
          socialLinks[platform as keyof SocialLinks] = href.startsWith("http") ? href : `https://${href}`;
        }
      }
    }

    // 1. <a href> tags
    $("a[href]").each((_, el) => applySocialUrl($(el).attr("href") ?? ""));

    // 2. JSON-LD sameAs (e.g. Yoast SEO on WordPress always outputs this)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? "") as Record<string, unknown>;
        const sameAs = data["sameAs"];
        if (Array.isArray(sameAs)) sameAs.forEach((u: unknown) => typeof u === "string" && applySocialUrl(u));
        else if (typeof sameAs === "string") applySocialUrl(sameAs);
        // Also check @graph array
        if (Array.isArray(data["@graph"])) {
          (data["@graph"] as Record<string, unknown>[]).forEach(node => {
            const ns = node["sameAs"];
            if (Array.isArray(ns)) ns.forEach((u: unknown) => typeof u === "string" && applySocialUrl(u));
          });
        }
      } catch { /* malformed JSON-LD */ }
    });

    // 3. Raw HTML scan for social URLs not in <a> tags (catches icon fonts, JS onclick, etc.)
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (!socialLinks[platform as keyof SocialLinks]) {
        const m = html.match(new RegExp(`https?:\\/\\/${pattern.source}`, "i"));
        if (m) socialLinks[platform as keyof SocialLinks] = m[0].split(/["'\s>]/)[0];
      }
    }

    // Meta tags
    const metaTitle = $("title").first().text().trim() || $('meta[property="og:title"]').attr("content") || null;
    const metaDescription = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || null;

    // Technology detection
    const technologies: string[] = [];
    const htmlLower = html.toLowerCase();
    for (const [cms, pattern] of Object.entries(CMS_PATTERNS)) {
      if (new RegExp(pattern).test(htmlLower)) {
        technologies.push(cms);
        break;
      }
    }
    if (/gtag\(|google-analytics/.test(htmlLower)) technologies.push("Google Analytics");
    if (/fbq\(|facebook\.net\/en_US\/fbevents/.test(htmlLower)) technologies.push("Meta Pixel");

    // Emails, mobiles, WhatsApp
    const emails = extractEmails(html);
    const contactEmail = emails[0] ?? null;
    const mobiles = extractMobiles(html);
    const whatsapp = extractWhatsApp(html);

    return { socialLinks, metaTitle, metaDescription, technologies, contactEmail, emails, mobiles, whatsapp };
  } catch {
    return defaultResult;
  }
}

export interface PageSpeedResult {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  /** Set when PageSpeed could not be run; the scores above are then zero placeholders. */
  error?: string;
}

export async function runPageSpeedAudit(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const defaultResult: PageSpeedResult = {
    performanceScore: 0, seoScore: 0, accessibilityScore: 0,
    bestPracticesScore: 0, firstContentfulPaint: 0, largestContentfulPaint: 0,
  };

  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}` +
      `&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES` +
      (apiKey ? `&key=${encodeURIComponent(apiKey)}` : "") +
      `&strategy=mobile`;

    // Lighthouse runs on Google's side and regularly takes 20-40s for slow sites.
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(45000) });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as
        { error?: { message?: string; details?: { reason?: string }[] } } | null;
      const reason = body?.error?.details?.find((d) => d.reason)?.reason;
      let error: string;
      if (res.status === 403) {
        error = reason === "API_KEY_SERVICE_BLOCKED"
          ? "PageSpeed Insights API is blocked for this API key. Enable it on the key's API restrictions or set PAGESPEED_API_KEY."
          : `PageSpeed access denied (403${reason ? `, ${reason}` : ""}). Check PAGESPEED_API_KEY.`;
      } else if (res.status === 429) {
        error = "PageSpeed quota exceeded (429). Set PAGESPEED_API_KEY to a key with PageSpeed Insights enabled.";
      } else {
        error = `PageSpeed request failed (HTTP ${res.status})`;
      }
      console.error(`[PageSpeed] ${error} — ${url}`);
      return { ...defaultResult, error };
    }

    const data = await res.json() as {
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
          seo?: { score?: number };
          accessibility?: { score?: number };
          "best-practices"?: { score?: number };
        };
        audits?: {
          "first-contentful-paint"?: { numericValue?: number };
          "largest-contentful-paint"?: { numericValue?: number };
        };
      };
    };

    const cats = data.lighthouseResult?.categories ?? {};
    const audits = data.lighthouseResult?.audits ?? {};

    return {
      performanceScore: Math.round((cats.performance?.score ?? 0) * 100),
      seoScore: Math.round((cats.seo?.score ?? 0) * 100),
      accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      firstContentfulPaint: Math.round(audits["first-contentful-paint"]?.numericValue ?? 0),
      largestContentfulPaint: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    };
  } catch (err) {
    console.error(`[PageSpeed] Audit failed for ${url}:`, err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { ...defaultResult, error: timedOut ? "PageSpeed timed out after 45s" : "PageSpeed request failed" };
  }
}

export interface SeoScanResult {
  score: number;
  hasTitle: boolean;
  titleLength: number;
  hasMetaDescription: boolean;
  metaDescriptionLength: number;
  h1Count: number;
  hasSitemap: boolean;
  hasRobots: boolean;
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  ogImage: string | null;
  canonicalUrl: string | null;
  issues: string[];
}

export async function runSeoScan(url: string, html: string): Promise<SeoScanResult> {
  const $ = cheerio.load(html);
  const issues: string[] = [];

  const title = $("title").first().text().trim();
  const hasTitle = title.length > 0;
  const titleLength = title.length;
  if (!hasTitle) issues.push("Missing page title");
  else if (titleLength < 30 || titleLength > 65) issues.push(`Title length (${titleLength}) not optimal (30-65 chars)`);

  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  const hasMetaDescription = metaDesc.length > 0;
  const metaDescriptionLength = metaDesc.length;
  if (!hasMetaDescription) issues.push("Missing meta description");

  const h1Count = $("h1").length;
  if (h1Count === 0) issues.push("No H1 tag found");
  else if (h1Count > 1) issues.push(`Multiple H1 tags (${h1Count})`);

  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
  if (!hasStructuredData) issues.push("No structured data (JSON-LD)");

  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  if (!hasOpenGraph) issues.push("No Open Graph tags");

  let hasSitemap = false;
  let hasRobots = false;
  try {
    const baseUrl = new URL(url).origin;
    const [sitemapRes, robotsRes] = await Promise.all([
      safeFetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(3000) }),
      safeFetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(3000) }),
    ]);
    hasSitemap = sitemapRes.ok;
    hasRobots = robotsRes.ok;
  } catch { /* ignore */ }

  const passed = [hasTitle, hasMetaDescription, h1Count === 1, hasSitemap, hasStructuredData, hasOpenGraph].filter(Boolean).length;
  const score = Math.round((passed / 6) * 100);

  const ogImage = $('meta[property="og:image"]').attr("content") ?? null;
  const canonicalUrl = $('link[rel="canonical"]').attr("href") ?? null;

  return { score, hasTitle, titleLength, hasMetaDescription, metaDescriptionLength, h1Count, hasSitemap, hasRobots, hasStructuredData, hasOpenGraph, ogImage, canonicalUrl, issues };
}

export interface TechStackResult {
  cms: string | null;
  hasAnalytics: boolean;
  hasMetaPixel: boolean;
  hasChatWidget: boolean;
  hasCookieConsent: boolean;
  hasSSL: boolean;
  hasMobileViewport: boolean;
  techStack: string[];
  techStackDetailed: TechStackDetailed;
}

export async function detectTechStack(url: string, html: string, headers: Headers): Promise<TechStackResult> {
  const $ = cheerio.load(html);
  const htmlLower = html.toLowerCase();

  // Check server/CDN headers for hosting hints
  const serverHeader = (headers.get("server") ?? "").toLowerCase();
  const poweredBy = (headers.get("x-powered-by") ?? "").toLowerCase();
  const headerStr = `${serverHeader} ${poweredBy}`;

  const techStackDetailed: TechStackDetailed = {
    platforms: [], analytics: [], advertising: [], payment: [],
    email_marketing: [], customer_support: [], hosting_cdn: [],
    social_proof: [], booking: [],
  };

  for (const [category, techs] of Object.entries(TECH_PATTERNS) as [keyof TechStackDetailed, Record<string, string>][]) {
    for (const [name, pattern] of Object.entries(techs)) {
      const re = new RegExp(pattern, "i");
      const source = category === "hosting_cdn" ? `${htmlLower} ${headerStr}` : htmlLower;
      if (re.test(source)) {
        techStackDetailed[category].push(name);
      }
    }
  }

  // Flat list (backward compat) — deduplicate across categories
  const seen = new Set<string>();
  const techStack: string[] = [];
  for (const items of Object.values(techStackDetailed)) {
    for (const t of items) {
      if (!seen.has(t)) { seen.add(t); techStack.push(t); }
    }
  }

  // Derive backward-compat booleans
  const cms = techStackDetailed.platforms[0] ?? null;
  const hasAnalytics = techStackDetailed.analytics.length > 0;
  const hasMetaPixel = techStackDetailed.advertising.includes("Meta Pixel");
  const hasChatWidget = techStackDetailed.customer_support.length > 0;
  const hasCookieConsent = /cookiebot|cookieconsent|onetrust|cookie-consent|tarteaucitron|gdpr-cookie|js-cookie-banner/.test(htmlLower)
    || $('[class*="cookie"]').length > 0
    || $('[id*="cookie"]').length > 0;
  const hasSSL = url.startsWith("https://");
  const hasMobileViewport = $('meta[name="viewport"]').length > 0;

  return { cms, hasAnalytics, hasMetaPixel, hasChatWidget, hasCookieConsent, hasSSL, hasMobileViewport, techStack, techStackDetailed };
}

export interface FreshnessResult {
  hasBlog: boolean;
  lastPostDate: string | null;
  daysSinceLastPost: number | null;
  freshnessScore: number;
}

function freshnessScoreFromDays(days: number): number {
  if (days < 7) return 100;
  if (days < 30) return 80;
  if (days < 90) return 60;
  if (days < 180) return 30;
  return 10;
}

function extractMostRecentDate(blogHtml: string): Date | null {
  const $b = cheerio.load(blogHtml);
  const candidates: Date[] = [];

  // 1. <time datetime="..."> elements
  $b("time[datetime]").each((_, el) => {
    const val = $b(el).attr("datetime");
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) candidates.push(d);
    }
  });

  // 2. Meta tags: article:published_time, datePublished
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="datePublished"]',
    'meta[name="datePublished"]',
  ];
  for (const sel of metaSelectors) {
    const content = $b(sel).attr("content");
    if (content) {
      const d = new Date(content);
      if (!isNaN(d.getTime())) candidates.push(d);
    }
  }

  // 3. JSON-LD datePublished
  $b('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($b(el).html() ?? "") as Record<string, unknown>;
      const val = json["datePublished"] ?? json["dateModified"];
      if (typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) candidates.push(d);
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  // 4. Text patterns: "January 15, 2024" or "2024-01-15"
  const bodyText = $b("body").text();
  const isoPattern = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  const longPattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;

  let m: RegExpExecArray | null;
  while ((m = isoPattern.exec(bodyText)) !== null) {
    const d = new Date(m[0]);
    if (!isNaN(d.getTime())) candidates.push(d);
  }
  while ((m = longPattern.exec(bodyText)) !== null) {
    const d = new Date(m[0]);
    if (!isNaN(d.getTime())) candidates.push(d);
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, d) => (d > latest ? d : latest));
}

export interface DealsResult {
  has_deals: boolean;
  deals_keywords: string[];
}

const DEALS_KEYWORDS = [
  "deal", "deals", "special", "specials", "offer", "offers",
  "promotion", "promotions", "sale", "discount", "coupon",
  "voucher", "promo", "savings", "clearance", "limited time",
  "buy one get one", "bogo", "flash sale", "exclusive offer",
];

export function detectDealsAndSpecials(url: string, html: string): DealsResult {
  const $ = cheerio.load(html);
  const bodyText = ($("body").text() + " " + html).toLowerCase();
  const urlLower = url.toLowerCase();

  const found: string[] = [];

  // Check URL path for deals-related segments
  const dealPaths = ["deal", "special", "offer", "promo", "sale", "discount", "clearance"];
  for (const p of dealPaths) {
    if (urlLower.includes(`/${p}`) || urlLower.includes(`/${p}s`)) {
      found.push(p);
    }
  }

  // Check text content
  for (const kw of DEALS_KEYWORDS) {
    if (bodyText.includes(kw) && !found.includes(kw)) {
      found.push(kw);
    }
  }

  // Check for structured data Offer/SpecialAnnouncement
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "") as Record<string, unknown>;
      const type = String(json["@type"] ?? "").toLowerCase();
      if (type.includes("offer") || type.includes("specialannouncement")) {
        if (!found.includes("structured offer")) found.push("structured offer");
      }
    } catch { /* ignore */ }
  });

  // Check for nav/menu links to deal pages
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    const text = $(el).text().toLowerCase().trim();
    for (const p of dealPaths) {
      if ((href.includes(p) || text.includes(p)) && !found.includes(p)) {
        found.push(p);
      }
    }
  });

  const unique = [...new Set(found)].slice(0, 8);
  return { has_deals: unique.length > 0, deals_keywords: unique };
}

export async function checkContentFreshness(url: string, html: string): Promise<FreshnessResult> {
  const $ = cheerio.load(html);
  const blogLinks = $("a[href]").filter((_, el) => {
    const href = $(el).attr("href") ?? "";
    return /\/(blog|news|articles|posts|updates)(\/|$)/i.test(href);
  });

  if (blogLinks.length === 0) {
    return { hasBlog: false, lastPostDate: null, daysSinceLastPost: null, freshnessScore: 0 };
  }

  try {
    const rawHref = blogLinks.first().attr("href") ?? "";
    const blogUrl = new URL(rawHref, url).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    try {
      res = await safeFetch(blogUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadSightBot/1.0)" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return { hasBlog: true, lastPostDate: null, daysSinceLastPost: null, freshnessScore: 50 };
    }

    const blogHtml = await res.text();
    const mostRecent = extractMostRecentDate(blogHtml);

    if (mostRecent) {
      const daysSince = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
      return {
        hasBlog: true,
        lastPostDate: mostRecent.toISOString(),
        daysSinceLastPost: daysSince,
        freshnessScore: freshnessScoreFromDays(daysSince),
      };
    }
  } catch { /* network or parse failure */ }

  return { hasBlog: true, lastPostDate: null, daysSinceLastPost: null, freshnessScore: 50 };
}