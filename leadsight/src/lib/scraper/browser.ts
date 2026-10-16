// src/lib/scraper/browser.ts
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { existsSync } from "fs";

const IS_WINDOWS = process.platform === "win32";

const LOCAL_CHROME_PATHS: string[] = IS_WINDOWS
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ]
  : [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];

function findLocalChrome(): string | undefined {
  return LOCAL_CHROME_PATHS.find(p => p && existsSync(p));
}

const DESKTOP_CHROME_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];

export async function launchBrowser(): Promise<Browser> {
  let executablePath: string;
  let args: string[];

  // An explicit binary wins (the Docker image sets /usr/bin/chromium). It is a regular
  // Chrome/Chromium build, so it gets desktop args, not @sparticuz's serverless flags.
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  if (configured) {
    executablePath = configured;
    args = DESKTOP_CHROME_ARGS;
  } else if (!IS_WINDOWS) {
    // @sparticuz/chromium only works on Linux (serverless). On Windows/Mac use local Chrome.
    try {
      const chromium = await import("@sparticuz/chromium");
      executablePath = await chromium.default.executablePath();
      args = chromium.default.args;
    } catch {
      const local = findLocalChrome();
      if (!local) throw new Error("No Chrome executable found.");
      executablePath = local;
      args = DESKTOP_CHROME_ARGS;
    }
  } else {
    const local = findLocalChrome();
    if (!local) throw new Error("Chrome not found. Install Google Chrome to use PDF export.");
    executablePath = local;
    args = DESKTOP_CHROME_ARGS;
  }

  return puppeteer.launch({
    executablePath,
    args,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });
}

export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch {
    // Ignore close errors
  }
}
