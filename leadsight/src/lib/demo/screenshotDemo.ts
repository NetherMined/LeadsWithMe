/**
 * lib/demo/screenshotDemo.ts
 *
 * Renders a self-contained HTML string in headless Chromium and captures
 * desktop + mobile screenshots. Uses page.setContent() so NO local server is
 * required — this runs inside your existing serverless setup, the same way the
 * proof module already drives Chromium.
 *
 * INTEGRATION: you already launch Chromium in lib/screenshots/capture.ts.
 * Reuse that launcher for consistency; getBrowser() below just mirrors your
 * documented puppeteer-core + @sparticuz/chromium stack so this file is runnable.
 */

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

export interface DemoShots {
  desktop: Buffer;
  mobile: Buffer;
}

async function getBrowser(): Promise<Browser> {
  // Local dev: point CHROME_EXECUTABLE_PATH at your local Chrome/Chromium binary.
  const local = process.env.CHROME_EXECUTABLE_PATH;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: local || (await chromium.executablePath()),
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });
}

export async function screenshotDemo(html: string): Promise<DemoShots> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    // networkidle2 (≤2 active connections for 500ms) is used instead of networkidle0
    // because Tailwind CDN, Swiper, AOS, and Alpine.js are loaded from external URLs —
    // networkidle0 can time out while keep-alive connections to CDNs are still open.
    await page.setContent(html, { waitUntil: "networkidle2", timeout: 45000 });
    // Wait for fonts to finish loading.
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
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

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    const desktop = (await page.screenshot({ type: "png", fullPage: true })) as Buffer;

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
    });
    // Re-run AOS force after viewport change since a resize can reset some states.
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>("[data-aos]").forEach((el) => {
        el.classList.add("aos-animate");
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.transition = "none";
      });
    });
    await new Promise((r) => setTimeout(r, 400));
    const mobile = (await page.screenshot({ type: "png", fullPage: true })) as Buffer;

    return { desktop, mobile };
  } finally {
    await browser.close();
  }
}
