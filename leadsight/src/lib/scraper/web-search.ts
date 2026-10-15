import type { SocialLinks, WebResult } from "@/types/business";
import { calculateStringSimilarity } from "@/types/helpers";
import {
  SOCIAL_PATTERNS,
  extractEmails,
  extractMobiles,
  extractWhatsApp,
} from "@/lib/scraper/website";

export interface WebSearchEnrichment {
  website: string | null;
  socialLinks: Partial<SocialLinks>;
  emails: string[];
  mobile: string | null;
  whatsapp: string | null;
  webResults: WebResult[];
}

const DIRECTORY_DOMAINS = new Set([
  // Business directories
  "yelp.com", "yellowpages.com", "hotfrog.com", "cylex.com",
  "manta.com", "superpages.com", "foursquare.com",
  "tripadvisor.com", "trustpilot.com", "bbb.org",
  "yell.com", "whitepages.com", "chamberofcommerce.com",
  "mapquest.com", "citysearch.com", "merchantcircle.com",
  "brownbook.net", "spoke.com", "tupalo.com", "showmelocal.com",
  "findopen.com", "opendi.com", "cybo.com",
  // SA-specific directories
  "yellosa.co.za", "localsearch.co.za", "brabys.com",
  "sa-venues.com", "where2go.co.za",
  // Review/listing platforms
  "glassdoor.com", "indeed.com", "angieslist.com",
  "thumbtack.com", "bark.com", "homeadvisor.com",
  // Ad / tracking domains
  "googleadservices.com", "doubleclick.net", "googlesyndication.com",
]);

const SOCIAL_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
]);

interface BraveSearchResult {
  title: string;
  url: string;
  description?: string;
  meta_url?: { hostname?: string };
}

interface BraveSearchResponse {
  web?: { results?: BraveSearchResult[] };
  error?: { detail?: string };
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBlockedDomain(url: string): boolean {
  const domain = getDomain(url);
  if (!domain) return true;
  for (const blocked of DIRECTORY_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true;
  }
  for (const social of SOCIAL_DOMAINS) {
    if (domain === social || domain.endsWith(`.${social}`)) return true;
  }
  // Block generic search/maps URLs (but not business.google profiles)
  if (domain.includes("google.") && !domain.includes("business.google")) return true;
  return false;
}

function classifyUrl(url: string): "social" | "directory" | "website" {
  const domain = getDomain(url);
  for (const sd of SOCIAL_DOMAINS) {
    if (domain === sd || domain.endsWith(`.${sd}`)) return "social";
  }
  for (const dd of DIRECTORY_DOMAINS) {
    if (domain === dd || domain.endsWith(`.${dd}`)) return "directory";
  }
  return "website";
}

function extractSocialLink(url: string): { platform: keyof SocialLinks; url: string } | null {
  for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    if (pattern.test(url)) {
      return { platform: platform as keyof SocialLinks, url };
    }
  }
  return null;
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadSightBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Attempts to extract a website URL from a social media profile bio.
 * Supports Instagram and Facebook public pages.
 * Returns null if no website found or scrape fails.
 */
async function scrapeSocialBioForWebsite(
  profileUrl: string,
  platform: "instagram" | "facebook",
  signal: AbortSignal
): Promise<string | null> {
  try {
    const html = await fetchHtml(profileUrl, signal);

    if (platform === "instagram") {
      // Instagram embeds profile data as JSON in a <script> tag
      // Look for "website":"https://..." or "external_url":"https://..."
      const patterns = [
        /"external_url"\s*:\s*"([^"]+)"/,
        /"website"\s*:\s*"([^"]+)"/,
        /property="og:url"[^>]*content="([^"]+)"/,
      ];
      for (const pat of patterns) {
        const match = html.match(pat);
        if (match?.[1] && match[1].startsWith("http") && !isBlockedDomain(match[1])) {
          return match[1];
        }
      }
    }

    if (platform === "facebook") {
      // Facebook pages often have external website links in their about section
      const patterns = [
        /Website<\/(?:th|td|div|span)>\s*<(?:td|div|span)[^>]*>\s*<a[^>]+href="([^"]+)"/i,
        /"website"\s*:\s*"([^"]+)"/,
        /class="[^"]*profileLink[^"]*"[^>]*href="([^"]+)"/i,
        /data-hover="tooltip"[^>]*href="(https?:\/\/(?!www\.facebook\.com)[^"]+)"/i,
      ];
      for (const pat of patterns) {
        const match = html.match(pat);
        if (match?.[1] && match[1].startsWith("http") && !isBlockedDomain(match[1])) {
          // Decode Facebook redirect URLs
          try {
            const url = new URL(match[1]);
            const redirect = url.searchParams.get("u") ?? url.searchParams.get("href");
            if (redirect) return redirect;
          } catch { /* use as-is */ }
          return match[1];
        }
      }
    }
  } catch {
    // Silently fail — social scraping is best-effort
  }
  return null;
}

export async function enrichFromWebSearch(
  businessName: string,
  city: string,
  existingData: { website: string | null; socialLinks: SocialLinks }
): Promise<WebSearchEnrichment> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  const empty: WebSearchEnrichment = {
    website: null,
    socialLinks: {},
    emails: [],
    mobile: null,
    whatsapp: null,
    webResults: [],
  };

  if (!apiKey) return empty;

  const signal = AbortSignal.timeout(5000);

  const q = encodeURIComponent(`"${businessName}" "${city}"`);
  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${q}&count=10`;

  let results: BraveSearchResult[];
  try {
    const res = await fetch(searchUrl, {
      signal,
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });
    const data = await res.json() as BraveSearchResponse;
    if (!res.ok) {
      console.error("[WebSearch] Brave API error for", businessName, ":", data.error?.detail ?? res.status);
      return empty;
    }
    results = data.web?.results ?? [];
    console.log(`[WebSearch] "${businessName}" → ${results.length} results:`, results.map(r => r.url));
  } catch (err) {
    console.error("[WebSearch] fetch failed for", businessName, ":", err);
    return empty;
  }

  const webResults: WebResult[] = results.map((r) => ({
    source: r.meta_url?.hostname ?? getDomain(r.url),
    url: r.url,
    snippet: r.description ?? null,
  }));

  const socialLinks: Partial<SocialLinks> = {};
  let discoveredWebsite: string | null = null;
  const pagesToScrape: string[] = [];

  for (const result of results) {
    const type = classifyUrl(result.url);

    if (type === "social") {
      const found = extractSocialLink(result.url);
      if (found && !existingData.socialLinks[found.platform]) {
        socialLinks[found.platform] = found.url;
      }
      continue;
    }

    if (type === "directory") {
      if (pagesToScrape.length < 2) pagesToScrape.push(result.url);
      continue;
    }

    // Website candidate — only consider if no existing website
    if (!existingData.website && !discoveredWebsite) {
      const domain = getDomain(result.url);
      const similarity = calculateStringSimilarity(
        businessName.toLowerCase(),
        domain.split(".")[0].toLowerCase()
      );
      if (similarity >= 0.4) {
        discoveredWebsite = result.url;
      }
    }
  }

  // If still no website found, try scraping social profile bios for a website URL
  if (!existingData.website && !discoveredWebsite) {
    const bioSignal = AbortSignal.timeout(3000);
    // Try Facebook first (more likely to have website in profile), then Instagram
    const socialPriority: Array<{ platform: keyof SocialLinks; bioPlatform: "facebook" | "instagram" }> = [
      { platform: "facebook", bioPlatform: "facebook" },
      { platform: "instagram", bioPlatform: "instagram" },
    ];
    for (const { platform, bioPlatform } of socialPriority) {
      const profileUrl = socialLinks[platform] ?? existingData.socialLinks[platform];
      if (!profileUrl) continue;
      const bioWebsite = await scrapeSocialBioForWebsite(profileUrl, bioPlatform, bioSignal);
      if (bioWebsite) {
        console.log(`[SocialBio] Found website for ${businessName} via ${bioPlatform}: ${bioWebsite}`);
        discoveredWebsite = bioWebsite;
        break;
      }
    }
  }

  // Scrape directory pages for contact details (up to 2)
  const emails: string[] = [];
  let mobile: string | null = null;
  let whatsapp: string | null = null;

  for (const pageUrl of pagesToScrape) {
    try {
      const html = await fetchHtml(pageUrl, signal);
      const pageEmails = extractEmails(html);
      const pageMobiles = extractMobiles(html);
      const pageWhatsApp = extractWhatsApp(html);
      emails.push(...pageEmails);
      if (!mobile && pageMobiles.length > 0) mobile = pageMobiles[0];
      if (!whatsapp && pageWhatsApp) whatsapp = pageWhatsApp;
    } catch {
      /* skip unreachable pages */
    }
  }

  return {
    website: discoveredWebsite,
    socialLinks,
    emails: [...new Set(emails)].slice(0, 10),
    mobile,
    whatsapp,
    webResults,
  };
}
