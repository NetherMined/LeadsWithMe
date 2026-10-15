import type { ExternalDealResult } from "@/types/audit";

const DEAL_SITES = [
  {
    site: "WikiDeals",
    buildUrl: (name: string) => `https://www.wikideals.co.za/search?q=${encodeURIComponent(name)}`,
  },
  {
    site: "DaddyDeal",
    buildUrl: (name: string) => `https://www.daddysdeals.co.za/search?keyword=${encodeURIComponent(name)}`,
  },
  {
    site: "Groupon",
    buildUrl: (name: string) => `https://www.groupon.co.za/search?query=${encodeURIComponent(name)}`,
  },
];

export async function searchExternalDeals(
  businessName: string,
  city?: string | null
): Promise<ExternalDealResult[]> {
  const query = city ? `${businessName} ${city}` : businessName;
  const nameLower = businessName.toLowerCase();

  const results = await Promise.all(
    DEAL_SITES.map(async ({ site, buildUrl }) => {
      const url = buildUrl(query);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        let found = false;
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });
          if (res.ok) {
            const html = await res.text();
            found = html.toLowerCase().includes(nameLower);
          }
        } finally {
          clearTimeout(timeout);
        }
        return { site, url, found };
      } catch {
        return { site, url, found: false };
      }
    })
  );

  return results;
}
