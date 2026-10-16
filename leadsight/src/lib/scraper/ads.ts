import { safeFetch } from "@/lib/net/safe-fetch";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface MetaAdsResult {
  has_active_ads: boolean;
  active_ad_count: number;
  ad_categories: string[];
}

export interface GoogleAdsResult {
  has_google_ads: boolean;
  detection_method: string;
}

export interface DomainAuthorityResult {
  domain_authority: number | null;
  backlink_estimate: number | null;
  indexed_pages_estimate: number | null;
}

/**
 * Meta Ad Library is blocked for unauthenticated server-side requests.
 * Returns the default (no ads detected) without making a network call.
 */
export async function checkMetaAds(_businessName: string, _country = "ALL"): Promise<MetaAdsResult> {
  return { has_active_ads: false, active_ad_count: 0, ad_categories: [] };
}

export async function checkGoogleAds(websiteUrl: string): Promise<GoogleAdsResult> {
  const defaultResult: GoogleAdsResult = { has_google_ads: false, detection_method: "none" };

  try {
    const res = await safeFetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return defaultResult;

    const html = await res.text();

    // Check for Google Ads conversion tracking
    if (/gtag\(['"]config['"],\s*['"]AW-/i.test(html)) {
      return { has_google_ads: true, detection_method: "conversion_tracking" };
    }

    // Check for Google Ads remarketing
    if (/google_conversion_id|google_remarketing_only|googleads/i.test(html)) {
      return { has_google_ads: true, detection_method: "remarketing_pixel" };
    }

    // Check for Google Ads snippet
    if (/googletag\.cmd|googletag\.pubads\(\)|GPT\.googletag/i.test(html)) {
      return { has_google_ads: true, detection_method: "display_ads" };
    }

    return defaultResult;
  } catch {
    return defaultResult;
  }
}

export async function estimateDomainAuthority(domain: string): Promise<DomainAuthorityResult> {
  const defaultResult: DomainAuthorityResult = {
    domain_authority: null,
    backlink_estimate: null,
    indexed_pages_estimate: null,
  };

  try {
    // Strip protocol and www. prefix, then remove any path/query
    const cleanDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

    const oprKey = process.env.OPENPAGERANK_API_KEY;
    if (!oprKey) return defaultResult;

    const apiUrl = `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${encodeURIComponent(cleanDomain)}`;
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "API-OPR": oprKey },
    });

    if (!res.ok) return defaultResult;

    const data = await res.json();
    const entry = data.response?.[0];

    if (!entry || entry.status_code !== 200) return defaultResult;

    const prDecimal: number = entry.page_rank_decimal ?? 0;

    // page_rank_decimal of 0 or missing → both values are 0
    if (!prDecimal) {
      return {
        domain_authority: 0,
        backlink_estimate: 0,
        indexed_pages_estimate: null,
      };
    }

    // Scale 0–10 to 0–100
    const domain_authority = Math.round(prDecimal * 10);

    // Estimate backlinks from global rank
    const globalRank: number = parseInt(entry.rank, 10);
    let backlink_estimate: number;
    if (!Number.isFinite(globalRank) || globalRank <= 0) {
      backlink_estimate = 0;
    } else if (globalRank < 10_000) {
      backlink_estimate = 100_000;
    } else if (globalRank < 100_000) {
      backlink_estimate = 10_000;
    } else if (globalRank < 1_000_000) {
      backlink_estimate = 1_000;
    } else {
      backlink_estimate = 100;
    }

    return {
      domain_authority,
      backlink_estimate,
      indexed_pages_estimate: null,
    };
  } catch {
    return defaultResult;
  }
}
