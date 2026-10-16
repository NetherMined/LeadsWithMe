// src/lib/competitor/scraper.ts
import type { Browser } from "puppeteer-core";
import type { SiteAnalysis } from "@/types/report";
import { assertPublicUrl, guardPage, safeFetch } from "@/lib/net/safe-fetch";

const CTA_KEYWORDS = [
  "get started", "book now", "contact us", "call us", "free quote", "get a quote",
  "sign up", "try free", "learn more", "schedule", "book a", "request", "enquire",
  "buy now", "order now", "shop now", "subscribe", "download", "get free",
];

const CTA_SELECTORS = [
  "a.btn", "a.button", "button.btn", "button.cta", ".cta a", ".hero a",
  "[class*='cta']", "[class*='button']", "[class*='btn']",
  "a[href*='contact']", "a[href*='book']", "a[href*='quote']",
];

const ANALYTICS_PATTERNS: Record<string, string> = {
  "Google Analytics": "google-analytics|gtag|UA-|G-[A-Z0-9]",
  "Google Tag Manager": "googletagmanager",
  Hotjar: "hotjar|hjid",
  Mixpanel: "mixpanel",
  "Meta Pixel": "fbq|facebook.*pixel|fbevents",
  Clarity: "clarity\\.ms",
};

const CHAT_PATTERNS = [
  "intercom", "drift", "tawk", "tidio", "crisp", "zendesk", "freshdesk",
  "livechat", "hubspot.*chat", "chat-widget",
];

const PAGE_TIMEOUT = 20_000;

function detectLayoutType(html: string): SiteAnalysis["layoutType"] {
  const lower = html.toLowerCase();
  if (lower.includes("display:grid") || lower.includes("display: grid")) return "grid";
  if (lower.includes("display:flex") || lower.includes("display: flex")) return "multi-column";
  if (lower.includes("container") || lower.includes("wrapper")) return "single-column";
  return "unknown";
}

export async function deepScrape(url: string, browser: Browser): Promise<SiteAnalysis> {
  const page = await browser.newPage();
  let loadTimeMs: number | null = null;

  try {
    await assertPublicUrl(url);
    await guardPage(page);
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT });
    loadTimeMs = Date.now() - t0;

    // Get full HTML source for pattern matching
    const html = await page.content();
    const htmlLower = html.toLowerCase();

    // --- DOM analysis via page.evaluate ---
    const domData = await page.evaluate((ctaKeywords: string[], ctaSelectors: string[]) => {
      // Nav
      const navLinks = document.querySelectorAll("nav a, header a");
      const navItemCount = navLinks.length;
      const hasHamburgerMenu = !!(
        document.querySelector("[class*='hamburger'], [class*='burger'], [class*='menu-toggle'], [aria-label*='menu']")
      );
      const footerLinks = document.querySelectorAll("footer a");
      const hasFooterLinks = footerLinks.length > 0;

      // Hero headline
      const heroEl = document.querySelector(".hero h1, .hero h2, header h1, [class*='hero'] h1, [class*='banner'] h1, main h1");
      const heroHeadline = heroEl?.textContent?.trim() ?? null;

      // Testimonials
      const testimonialEls = document.querySelectorAll(
        "[class*='testimonial'], [class*='review'], [class*='quote'], blockquote"
      );
      const testimonialCount = testimonialEls.length;
      const hasTestimonials = testimonialCount > 0;

      // Video
      const hasVideo = !!(
        document.querySelector("video, iframe[src*='youtube'], iframe[src*='vimeo'], [class*='video']")
      );

      // Pricing
      const hasPricing = !!document.querySelector(
        "[class*='price'], [class*='pricing'], [class*='plan'], [class*='package']"
      );

      // Blog
      const hasBlog = !!(
        document.querySelector("article, [class*='blog'], [class*='post'], [class*='news']")
      );

      // Word count (body text)
      const bodyText = document.body?.innerText ?? "";
      const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

      // Images
      const imageCount = document.querySelectorAll("img").length;

      // CTAs
      const ctaTexts: string[] = [];
      const ctaEls = new Set<Element>();

      // Find CTAs by selector
      for (const sel of ctaSelectors) {
        document.querySelectorAll(sel).forEach(el => ctaEls.add(el));
      }

      // Find CTAs by text
      document.querySelectorAll("a, button").forEach(el => {
        const text = el.textContent?.trim().toLowerCase() ?? "";
        if (ctaKeywords.some(kw => text.includes(kw))) {
          ctaEls.add(el);
        }
      });

      ctaEls.forEach(el => {
        const text = el.textContent?.trim();
        if (text && !ctaTexts.includes(text)) ctaTexts.push(text);
      });

      const ctaCount = ctaEls.size;

      // Above-fold CTA: within first 900px
      const vh = window.innerHeight || 900;
      let hasCtaAboveFold = false;
      ctaEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh) hasCtaAboveFold = true;
      });

      // Floating CTA
      const hasFloatingCta = !!(
        document.querySelector("[class*='floating'], [class*='sticky-cta'], [class*='fixed-cta']") ||
        [...ctaEls].some(el => {
          const style = window.getComputedStyle(el);
          return style.position === "fixed" || style.position === "sticky";
        })
      );

      // CTA placements
      const ctaPlacements: string[] = [];
      if (hasCtaAboveFold) ctaPlacements.push("above-fold");
      if (hasFloatingCta) ctaPlacements.push("floating");
      if (ctaCount > 0) ctaPlacements.push("inline");

      // Colors — sample getComputedStyle on key elements
      const bodyStyle = window.getComputedStyle(document.body);
      const btnEl = document.querySelector("button, .btn, a.button");
      const btnStyle = btnEl ? window.getComputedStyle(btnEl) : null;

      const background = bodyStyle.backgroundColor || null;
      const primary = btnStyle?.backgroundColor ?? bodyStyle.color ?? null;
      const linkEl = document.querySelector("a");
      const secondary = linkEl ? window.getComputedStyle(linkEl).color : null;

      // Fonts
      const fontSet = new Set<string>();
      [document.body, document.querySelector("h1"), document.querySelector("p")].forEach(el => {
        if (!el) return;
        const f = window.getComputedStyle(el).fontFamily;
        if (f) fontSet.add(f.split(",")[0].trim().replace(/['"]/g, ""));
      });
      const fontFamilies = [...fontSet].filter(Boolean);

      // Internal page count (nav links pointing to same origin)
      const origin = window.location.origin;
      const internalLinks = new Set<string>();
      document.querySelectorAll("a[href]").forEach(a => {
        try {
          const u = new URL((a as HTMLAnchorElement).href);
          if (u.origin === origin && u.pathname !== "/") internalLinks.add(u.pathname);
        } catch { /* ignore */ }
      });

      return {
        navItemCount,
        hasHamburgerMenu,
        hasFooterLinks,
        heroHeadline,
        hasTestimonials,
        testimonialCount,
        hasVideo,
        hasPricing,
        hasBlog,
        wordCount,
        imageCount,
        ctaCount,
        hasCtaAboveFold,
        hasFloatingCta,
        ctaTexts: ctaTexts.slice(0, 10),
        ctaPlacements,
        colorScheme: { primary, secondary, background },
        fontFamilies,
        internalPageCount: internalLinks.size,
      };
    }, CTA_KEYWORDS, CTA_SELECTORS);

    // --- Pattern matching on HTML source ---

    // Tech stack from script tags
    const scriptTags = html.match(/<script[^>]*src=["'][^"']*["'][^>]*>/g) ?? [];
    const scriptSrcs = scriptTags.map(t => t.match(/src=["']([^"']+)/)?.[1] ?? "").filter(Boolean);
    const techStack: string[] = [];

    const TECH_CHECKS: Record<string, string> = {
      "WordPress": "wp-content|wp-includes",
      "Shopify": "cdn\\.shopify",
      "Wix": "wixstatic\\.com",
      "Squarespace": "squarespace\\.com",
      "Webflow": "webflow\\.com",
      "Next.js": "__next|_next/static",
      "React": "react\\.production|chunk\\.js",
      "Tailwind": "tailwind",
    };

    for (const [name, pattern] of Object.entries(TECH_CHECKS)) {
      if (new RegExp(pattern, "i").test(htmlLower)) techStack.push(name);
    }

    // Analytics
    const analyticsTools: string[] = [];
    for (const [name, pattern] of Object.entries(ANALYTICS_PATTERNS)) {
      if (new RegExp(pattern, "i").test(htmlLower)) analyticsTools.push(name);
    }
    const hasAnalytics = analyticsTools.length > 0;

    // Chat widget
    const hasChatWidget = CHAT_PATTERNS.some(p => new RegExp(p, "i").test(htmlLower));

    // SEO
    const hasSchemaMarkup = htmlLower.includes("application/ld+json") || htmlLower.includes("schema.org");
    const hasOpenGraph = htmlLower.includes('property="og:') || htmlLower.includes("property='og:");
    const hasCanonical = htmlLower.includes('rel="canonical"') || htmlLower.includes("rel='canonical'");
    const metaTitle = (await page.title().catch(() => null));
    const metaDescription = await page.$eval(
      'meta[name="description"]',
      el => (el as HTMLMetaElement).content
    ).catch(() => null);

    // Sitemap check
    let hasSitemap = false;
    try {
      const origin = new URL(url).origin;
      const sitemapRes = await safeFetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(3000) });
      hasSitemap = sitemapRes.ok;
    } catch { /* ignore */ }

    const layoutType = detectLayoutType(html);

    return {
      url,
      ...domData,
      techStack,
      hasAnalytics,
      analyticsTools,
      hasChatWidget,
      loadTimeMs,
      hasSchemaMarkup,
      hasSitemap,
      hasOpenGraph,
      hasCanonical,
      metaTitle,
      metaDescription,
      layoutType,
    };
  } catch (err) {
    // Return minimal analysis on error
    return {
      url,
      navItemCount: 0,
      hasHamburgerMenu: false,
      internalPageCount: 0,
      hasFooterLinks: false,
      heroHeadline: null,
      hasTestimonials: false,
      testimonialCount: 0,
      hasVideo: false,
      hasPricing: false,
      hasBlog: false,
      wordCount: 0,
      imageCount: 0,
      ctaCount: 0,
      hasCtaAboveFold: false,
      hasFloatingCta: false,
      ctaTexts: [],
      ctaPlacements: [],
      colorScheme: { primary: null, secondary: null, background: null },
      fontFamilies: [],
      layoutType: "unknown",
      techStack: [],
      hasAnalytics: false,
      analyticsTools: [],
      hasChatWidget: false,
      loadTimeMs: null,
      hasSchemaMarkup: false,
      hasSitemap: false,
      hasOpenGraph: false,
      hasCanonical: false,
      metaTitle: null,
      metaDescription: null,
    };
  } finally {
    await page.close().catch(() => {});
  }
}
