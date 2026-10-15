// src/lib/screenshots/capture.ts
import type { Browser } from "puppeteer-core";
import type { ScreenshotResult } from "@/types/report";

const COOKIE_SELECTORS = [
  "#accept-cookies",
  "#cookie-accept",
  ".cookie-accept",
  ".accept-cookies",
  "[data-testid='cookie-accept']",
  "[aria-label*='Accept']",
  "button[class*='cookie']:not([class*='decline'])",
  "button[class*='consent']:not([class*='decline'])",
  ".js-cookie-consent-agree",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  ".cc-accept-all",
  ".cc-btn.cc-allow",
];

const PAGE_TIMEOUT_MS = 15_000;

interface CaptureOptions {
  desktopViewport?: { width: number; height: number };
  mobileViewport?: { width: number; height: number };
  maxInternalPages?: number;
}

async function tryDismissCookieBanner(page: import("puppeteer-core").Page): Promise<void> {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 500));
        return;
      }
    } catch {
      // Continue trying other selectors
    }
  }
}

async function captureOnePage(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
): Promise<ScreenshotResult | null> {
  const page = await browser.newPage();
  try {
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT_MS });
    await tryDismissCookieBanner(page);
    await new Promise(r => setTimeout(r, 500)); // settle animations

    const title = await page.title().catch(() => "");
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: "png" }) as Buffer;
    const screenshotBase64 = screenshotBuffer.toString("base64");

    return {
      url,
      pageTitle: title,
      screenshotBuffer,
      screenshotBase64,
      viewport,
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function discoverInternalPages(browser: Browser, baseUrl: string): Promise<string[]> {
  const page = await browser.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    const links = await page.evaluate((base) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const seen = new Set<string>();
      const results: string[] = [];
      const priority = ["service", "about", "contact", "product", "portfolio", "work", "team"];

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        try {
          const url = new URL(href);
          if (url.origin !== new URL(base).origin) continue;
          if (url.pathname === "/" || url.pathname === "") continue;
          if (seen.has(url.href)) continue;
          seen.add(url.href);
          results.push(url.href);
        } catch {
          // skip invalid URLs
        }
      }

      // Sort by priority keywords
      return results.sort((a, b) => {
        const aScore = priority.findIndex(k => a.toLowerCase().includes(k));
        const bScore = priority.findIndex(k => b.toLowerCase().includes(k));
        const aN = aScore === -1 ? priority.length : aScore;
        const bN = bScore === -1 ? priority.length : bScore;
        return aN - bN;
      });
    }, baseUrl);
    return links;
  } catch {
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Capture screenshots of a website.
 * Returns: desktop homepage, up to 3 internal pages, mobile homepage.
 * Returns [] if the site is unreachable.
 * Receives a shared browser instance — does NOT launch its own.
 */
export async function captureScreenshots(
  websiteUrl: string,
  browser: Browser,
  options: CaptureOptions = {},
): Promise<ScreenshotResult[]> {
  const desktop = options.desktopViewport ?? { width: 1440, height: 900 };
  const mobile = options.mobileViewport ?? { width: 375, height: 812 };
  const maxInternal = options.maxInternalPages ?? 3;

  const results: ScreenshotResult[] = [];

  // Desktop homepage
  const homepageDesktop = await captureOnePage(browser, websiteUrl, desktop);
  if (!homepageDesktop) return []; // Site is down — skip entirely
  results.push(homepageDesktop);

  // Internal pages
  const internalUrls = await discoverInternalPages(browser, websiteUrl);
  const toCapture = internalUrls.slice(0, maxInternal);
  for (const url of toCapture) {
    const shot = await captureOnePage(browser, url, desktop);
    if (shot) results.push(shot);
  }

  // Mobile homepage
  const homepageMobile = await captureOnePage(browser, websiteUrl, mobile);
  if (homepageMobile) results.push(homepageMobile);

  return results;
}
