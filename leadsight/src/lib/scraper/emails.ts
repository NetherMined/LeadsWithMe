/**
 * Deep email scraper.
 * Crawls the business website (homepage + contact/about pages) and
 * attempts to extract emails from accessible social profile pages.
 */
import * as cheerio from "cheerio";
import type { SocialLinks } from "@/types/business";

export interface EmailResult {
  email: string;
  source: string;       // e.g. "website:/contact", "youtube", "facebook"
  confidence: "high" | "medium" | "low";
  // high = found in mailto: href or JSON-LD
  // medium = found in visible text near contact keywords
  // low = found in raw HTML body
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Pages to probe relative to the website root (in priority order)
const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/reach-us",
  "/get-in-touch",
  "/info",
];

// Noise email patterns to skip
const SKIP_PATTERNS = [
  /sentry\.io/i,
  /amazonaws\.com/i,
  /wixpress\.com/i,
  /squarespace\.com/i,
  /example\.(com|org|net)/i,
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /cloudfront\.net/i,
  /googletagmanager/i,
  /facebook\.com/i,
  /google\.com/i,
  /schema\.org/i,
  /w3\.org/i,
];

// Extensions that are never valid email TLDs — catches filenames like artboard@3x-300x300.png
const FILE_EXT_TLDS = new Set([
  "png","jpg","jpeg","gif","svg","webp","ico","bmp","tiff","avif",
  "css","js","ts","jsx","tsx","json","xml","html","htm",
  "woff","woff2","ttf","eot","otf",
  "pdf","zip","tar","gz","rar","7z",
  "mp4","mp3","wav","ogg","avi","mov","webm",
  "php","asp","aspx","py","rb","go",
]);

function isValidEmail(email: string): boolean {
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return false;
  // Reject if the TLD is a file/media extension (e.g. artboard@3x.png, logo@2x.jpg)
  const tld = email.split(".").pop()?.toLowerCase() ?? "";
  if (FILE_EXT_TLDS.has(tld)) return false;
  return !SKIP_PATTERNS.some(p => p.test(email));
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Decode Cloudflare email obfuscation (data-cfemail XOR encoding).
 * Cloudflare XORs each byte with the first byte of the hex string.
 */
function decodeCfEmail(encoded: string): string | null {
  try {
    const key = parseInt(encoded.slice(0, 2), 16);
    let decoded = "";
    for (let i = 2; i < encoded.length; i += 2) {
      decoded += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
    }
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * Extract emails from an HTML document with confidence levels.
 * - mailto: links → high
 * - Cloudflare data-cfemail obfuscation → high
 * - JSON-LD structured data → high
 * - Text near contact keywords → medium
 * - Raw body occurrences → low
 */
function parseEmailsFromHtml(html: string, sourcePath: string): EmailResult[] {
  const $ = cheerio.load(html);
  const results: Map<string, EmailResult> = new Map();

  function add(email: string, confidence: "high" | "medium" | "low", sourceLabel?: string) {
    const e = email.toLowerCase().trim();
    if (!isValidEmail(e)) return;
    if (!results.has(e) || results.get(e)!.confidence === "low") {
      results.set(e, { email: e, source: sourceLabel ?? sourcePath, confidence });
    } else if (confidence === "high" && results.get(e)!.confidence !== "high") {
      results.get(e)!.confidence = "high";
    }
  }

  // 1. mailto: links (high confidence)
  $("a[href^='mailto:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
    add(email, "high", sourcePath);
  });

  // 2. Cloudflare email obfuscation (data-cfemail attribute — high confidence)
  $("[data-cfemail]").each((_, el) => {
    const encoded = $(el).attr("data-cfemail") ?? "";
    const decoded = decodeCfEmail(encoded);
    if (decoded) add(decoded, "high", sourcePath);
  });
  // Also scan raw HTML for __cf_email__ patterns (some themes inline the encoded value)
  const cfMatches = html.matchAll(/data-cfemail="([a-f0-9]+)"/gi);
  for (const m of cfMatches) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) add(decoded, "high", sourcePath);
  }

  // 3. JSON-LD structured data (high confidence)
  $('script[type="application/ld+json"]').each((_, el) => {
    const json = $(el).html() ?? "";
    const matches = json.matchAll(/"email"\s*:\s*"([^"]+)"/gi);
    for (const m of matches) add(m[1], "high", sourcePath);
  });

  // 3. Meta tags (medium)
  $("meta").each((_, el) => {
    const content = $(el).attr("content") ?? "";
    const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) add(emailMatch[0], "medium", sourcePath);
  });

  // 4. Text near contact-keyword elements (medium)
  const contactKeywords = ["contact", "email", "reach", "get in touch", "enquir", "info"];
  $("p, li, td, div, span").each((_, el) => {
    const text = $(el).text();
    const isNearContact = contactKeywords.some(kw => text.toLowerCase().includes(kw));
    const emailMatches = text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    for (const m of emailMatches) {
      add(m[0], isNearContact ? "medium" : "low", sourcePath);
    }
  });

  return [...results.values()];
}

/**
 * Resolve a path against a base URL, normalising trailing slashes.
 */
function resolveUrl(base: string, path: string): string {
  try {
    const u = new URL(base);
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return base + path;
  }
}

/**
 * Find internal links on the homepage that look like contact/about pages.
 */
function findContactLinks($: ReturnType<typeof cheerio.load>, base: string): string[] {
  const found: string[] = [];
  const contactPatterns = /contact|about|team|staff|reach|touch|enquir|info/i;
  $("a[href]").each((_, el) => {
    const href = $ (el).attr("href") ?? "";
    if (!contactPatterns.test(href)) return;
    // Internal links only
    if (href.startsWith("http")) {
      try {
        const linkBase = new URL(base).host;
        const linkHost = new URL(href).host;
        if (linkHost === linkBase) found.push(href);
      } catch { /* skip */ }
    } else if (href.startsWith("/") && !href.startsWith("//")) {
      found.push(resolveUrl(base, href));
    }
  });
  // Deduplicate
  return [...new Set(found)].slice(0, 8);
}


export async function scrapeWebsiteEmails(website: string): Promise<EmailResult[]> {
  const allResults: EmailResult[] = [];
  const fetchedUrls = new Set<string>();

  // Normalise base URL
  const base = website.startsWith("http") ? website.replace(/\/$/, "") : `https://${website}`;

  // 1. Fetch homepage
  const homepageHtml = await fetchHtml(base);
  if (!homepageHtml) return [];
  fetchedUrls.add(base);

  const homepageEmails = parseEmailsFromHtml(homepageHtml, "website:homepage");
  allResults.push(...homepageEmails);

  const $ = cheerio.load(homepageHtml);

  // 2. Collect candidate contact-page URLs
  const candidates = new Set<string>();

  // From explicit paths
  for (const path of CONTACT_PATHS) {
    candidates.add(resolveUrl(base, path));
  }

  // From homepage link scan
  for (const link of findContactLinks($, base)) {
    candidates.add(link);
  }

  // 3. Probe each candidate (max 6 additional pages, parallel)
  const probeUrls = [...candidates]
    .filter(u => !fetchedUrls.has(u))
    .slice(0, 6);

  const subpageResults = await Promise.allSettled(
    probeUrls.map(async (url) => {
      const html = await fetchHtml(url, 6000);
      if (!html) return [];
      const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();
      return parseEmailsFromHtml(html, `website:${path}`);
    })
  );

  for (const r of subpageResults) {
    if (r.status === "fulfilled") allResults.push(...r.value);
  }

  return deduplicateResults(allResults);
}


async function scrapeYouTubeEmail(url: string): Promise<EmailResult[]> {
  // YouTube channel About page sometimes shows business email
  const aboutUrl = url.replace(/\/(videos|shorts|playlists|community)?$/, "") + "/about";
  const html = await fetchHtml(aboutUrl, 8000);
  if (!html) return [];

  const results: EmailResult[] = [];

  // YouTube embeds channel data as JSON in the page
  const emailInJson = html.matchAll(/"email":"([^"]+)"/gi);
  for (const m of emailInJson) {
    const e = m[1].toLowerCase();
    if (isValidEmail(e)) results.push({ email: e, source: "youtube", confidence: "high" });
  }

  // Also check visible link text
  const $ = cheerio.load(html);
  $("a[href^='mailto:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const e = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (isValidEmail(e)) results.push({ email: e, source: "youtube", confidence: "high" });
  });

  // Plain text email in "For business inquiries" section
  const inquirySection = html.match(/business\s+inquiri?es?[^<]{0,100}/i);
  if (inquirySection) {
    const emailMatch = inquirySection[0].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && isValidEmail(emailMatch[0])) {
      results.push({ email: emailMatch[0].toLowerCase(), source: "youtube", confidence: "medium" });
    }
  }

  return results;
}

async function scrapeFacebookEmail(url: string): Promise<EmailResult[]> {
  // Facebook About page — often returns login wall but sometimes leaks structured data
  const aboutUrl = url.replace(/\/$/, "") + "/about";
  const html = await fetchHtml(aboutUrl, 8000);
  if (!html) return [];

  const results: EmailResult[] = [];

  // JSON-LD / meta email
  const emailInJson = html.matchAll(/"email"\s*:\s*"([^"]+)"/gi);
  for (const m of emailInJson) {
    const e = m[1].toLowerCase();
    if (isValidEmail(e)) results.push({ email: e, source: "facebook", confidence: "high" });
  }

  // mailto links
  const $ = cheerio.load(html);
  $("a[href^='mailto:']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const e = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (isValidEmail(e)) results.push({ email: e, source: "facebook", confidence: "high" });
  });

  return results;
}

async function scrapeInstagramEmail(url: string): Promise<EmailResult[]> {
  const html = await fetchHtml(url, 8000);
  if (!html) return [];

  const results: EmailResult[] = [];

  // Instagram embeds profile data as JSON; public_email is sometimes present
  const publicEmailMatch = html.match(/"public_email"\s*:\s*"([^"]+)"/i);
  if (publicEmailMatch && isValidEmail(publicEmailMatch[1])) {
    results.push({ email: publicEmailMatch[1].toLowerCase(), source: "instagram", confidence: "high" });
  }

  // Bio text sometimes contains email
  const bioMatch = html.match(/"biography"\s*:\s*"([^"]+)"/i);
  if (bioMatch) {
    const emailInBio = bioMatch[1].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailInBio && isValidEmail(emailInBio[0])) {
      results.push({ email: emailInBio[0].toLowerCase(), source: "instagram", confidence: "medium" });
    }
  }

  return results;
}

async function scrapeLinkedInEmail(url: string): Promise<EmailResult[]> {
  // LinkedIn requires login; minimal scraping possible but worth trying
  const html = await fetchHtml(url, 8000);
  if (!html) return [];

  const results: EmailResult[] = [];

  const emailInJson = html.matchAll(/"email"\s*:\s*"([^"]+)"/gi);
  for (const m of emailInJson) {
    const e = m[1].toLowerCase();
    if (isValidEmail(e)) results.push({ email: e, source: "linkedin", confidence: "high" });
  }

  return results;
}

async function scrapeTwitterEmail(url: string): Promise<EmailResult[]> {
  const html = await fetchHtml(url, 8000);
  if (!html) return [];

  const results: EmailResult[] = [];

  // Twitter/X bios sometimes contain emails
  const descMatch = html.match(/"description"\s*:\s*"([^"]+)"/i);
  if (descMatch) {
    const emailInDesc = descMatch[1].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailInDesc && isValidEmail(emailInDesc[0])) {
      results.push({ email: emailInDesc[0].toLowerCase(), source: "twitter", confidence: "medium" });
    }
  }

  return results;
}


export async function scrapeSocialEmails(socialLinks: SocialLinks): Promise<EmailResult[]> {
  const tasks: Promise<EmailResult[]>[] = [];

  if (socialLinks.youtube)   tasks.push(scrapeYouTubeEmail(socialLinks.youtube));
  if (socialLinks.facebook)  tasks.push(scrapeFacebookEmail(socialLinks.facebook));
  if (socialLinks.instagram) tasks.push(scrapeInstagramEmail(socialLinks.instagram));
  if (socialLinks.linkedin)  tasks.push(scrapeLinkedInEmail(socialLinks.linkedin));
  if (socialLinks.twitter)   tasks.push(scrapeTwitterEmail(socialLinks.twitter));
  // TikTok: no publicly accessible profile page with email

  const settled = await Promise.allSettled(tasks);
  const all: EmailResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return deduplicateResults(all);
}


/**
 * Merge results: keep highest confidence per email address, sort high→low.
 */
function deduplicateResults(results: EmailResult[]): EmailResult[] {
  const map = new Map<string, EmailResult>();
  const order: Record<string, number> = { high: 3, medium: 2, low: 1 };

  for (const r of results) {
    const existing = map.get(r.email);
    if (!existing || order[r.confidence] > order[existing.confidence]) {
      map.set(r.email, r);
    }
  }

  return [...map.values()].sort((a, b) => order[b.confidence] - order[a.confidence]);
}

/**
 * Full email enrichment: website deep crawl + social platforms.
 * Returns deduplicated, sorted results.
 */
export async function enrichEmails(
  website: string | null,
  socialLinks: SocialLinks,
): Promise<EmailResult[]> {
  const tasks: Promise<EmailResult[]>[] = [];

  if (website) tasks.push(scrapeWebsiteEmails(website));
  tasks.push(scrapeSocialEmails(socialLinks));

  const settled = await Promise.allSettled(tasks);
  const all: EmailResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  return deduplicateResults(all);
}
