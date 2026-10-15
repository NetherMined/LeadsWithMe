/**
 * lib/demo/screenshotDemo.ts
 *
 * Renders a self-contained HTML string in headless Chromium and captures
 * desktop + mobile screenshots. Uses page.setContent() so NO local server is
 * required — this runs inside your existing serverless setup, the same way the
 * proof module already drives Chromium.
 */

import type { Browser, Page } from "puppeteer-core";
import { launchBrowser } from "@/lib/scraper/browser";

export interface DemoShots {
  desktop: Buffer;
  mobile: Buffer;
}

type Viewport = Parameters<Page["setViewport"]>[0];

// Each size gets a fresh page with the viewport set BEFORE the content loads: switching an
// already-rendered page to isMobile leaves Chrome painting a blank 980px layout.
async function capture(browser: Browser, html: string, viewport: Viewport): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setViewport(viewport);
    // networkidle2 (≤2 active connections for 500ms) is used instead of networkidle0
    // because Tailwind CDN, Swiper, AOS, and Alpine.js are loaded from external URLs —
    // networkidle0 can time out while keep-alive connections to CDNs are still open.
    await page.setContent(html, { waitUntil: "networkidle2", timeout: 45000 });
    // Wait for fonts to finish loading.
    await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
    // Force all AOS elements to their final visible state so off-screen sections
    // appear correctly in full-page screenshots (AOS hides them until scroll).
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>("[data-aos]").forEach((el) => {
        el.classList.add("aos-animate");
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.transition = "none";
      });
    });
    // Small settle to allow any repaints triggered by the AOS class changes.
    await new Promise((r) => setTimeout(r, 600));
    return Buffer.from(await page.screenshot({ type: "png", fullPage: true }));
  } finally {
    await page.close().catch(() => {});
  }
}

export async function screenshotDemo(html: string): Promise<DemoShots> {
  const browser = await launchBrowser();
  try {
    const [desktop, mobile] = await Promise.all([
      capture(browser, html, { width: 1440, height: 900, deviceScaleFactor: 2 }),
      capture(browser, html, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
    ]);
    return { desktop, mobile };
  } finally {
    await browser.close();
  }
}
