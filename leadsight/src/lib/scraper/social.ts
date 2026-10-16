import type { SocialChannelAudit } from "@/types/audit";
import type { SocialLinks } from "@/types/business";
import { safeFetch } from "@/lib/net/safe-fetch";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<{ ok: boolean; html: string; status: number }> {
  try {
    const res = await safeFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    });
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, html, status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  }
}

function extractNumber(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const raw = match[1].replace(/[,\s]/g, "");
      const num = parseInt(raw, 10);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

export async function scrapeFacebook(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /(\d[\d,]*)\s*(?:people follow|followers)/i,
    /"followerCount":\s*(\d+)/,
    /content="(\d+) people follow/i,
  ];

  // Post count: try structured data or meta indicators
  const postCountPatterns = [
    /"postCount":\s*(\d+)/i,
    /"post_count":\s*(\d+)/i,
    /(\d+)\s*posts?\s*(?:this month|in the last 30)/i,
  ];
  const post_count_last_30d = result.ok ? extractNumber(result.html, postCountPatterns) : null;

  // Engagement: look for likes/comments on visible posts vs follower count
  let avg_engagement_rate: number | null = null;
  if (result.ok) {
    const likesMatch = result.html.match(/"likeCount":\s*(\d+)/);
    const commentsMatch = result.html.match(/"commentCount":\s*(\d+)/);
    const followers = extractNumber(result.html, followerPatterns);
    if (likesMatch && commentsMatch && followers && followers > 0) {
      const likes = parseInt(likesMatch[1], 10);
      const comments = parseInt(commentsMatch[1], 10);
      avg_engagement_rate = parseFloat(((likes + comments) / followers * 100).toFixed(2));
    }
  }

  return {
    platform: "facebook",
    url,
    exists: result.ok,
    is_verified: /is_verified.*?true|verified_badge/i.test(result.html),
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d,
    avg_engagement_rate,
    last_post_date: null,
    bio_complete: result.ok && result.html.includes("about") && result.html.length > 5000,
  };
}

export async function scrapeInstagram(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /"edge_followed_by":\{"count":(\d+)\}/,
    /(\d[\d,\.]+[KkMm]?)\s*[Ff]ollowers/,
    /"followers":(\d+)/,
  ];

  // Instagram: try to get total post count from window._sharedData
  // edge_owner_to_timeline_media.count is the total post count, not last-30d,
  // so we use it as a proxy only when we can't get recency data.
  const postCountPatterns = [
    /"edge_owner_to_timeline_media":\{"count":(\d+)/,
    /"media_count":(\d+)/,
  ];
  const post_count_last_30d = result.ok ? extractNumber(result.html, postCountPatterns) : null;

  // Instagram blocks engagement data without login — leave null
  const avg_engagement_rate: number | null = null;

  return {
    platform: "instagram",
    url,
    exists: result.ok && result.status !== 404,
    is_verified: /"is_verified":true/.test(result.html),
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d,
    avg_engagement_rate,
    last_post_date: null,
    bio_complete: result.ok && /"biography":"[^"]{10,}"/.test(result.html),
  };
}

export async function scrapeLinkedIn(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /(\d[\d,]+)\s*(?:follower|connection)/i,
    /"staffCount":(\d+)/,
  ];

  // LinkedIn: engagement metrics not publicly available
  return {
    platform: "linkedin",
    url,
    exists: result.ok && result.status !== 404,
    is_verified: false,
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d: null,
    avg_engagement_rate: null,
    last_post_date: null,
    bio_complete: result.ok && result.html.length > 3000,
  };
}

export async function scrapeTikTok(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /"followerCount":(\d+)/,
    /(\d[\d,\.]+[KkMm]?)\s*[Ff]ollowers/,
  ];

  // TikTok: look for video count in profile page HTML
  const postCountPatterns = [
    /"videoCount":(\d+)/,
    /"digg_count":(\d+)/,
    /(\d[\d,]*)\s*[Vv]ideos/,
  ];
  const post_count_last_30d = result.ok ? extractNumber(result.html, postCountPatterns) : null;

  // TikTok: engagement not reliably available without API
  return {
    platform: "tiktok",
    url,
    exists: result.ok && result.status !== 404,
    is_verified: /"verified":true/.test(result.html),
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d,
    avg_engagement_rate: null,
    last_post_date: null,
    bio_complete: result.ok && result.html.length > 3000,
  };
}

export async function scrapeTwitter(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /(\d[\d,]+)\s*[Ff]ollowers/,
    /"followers_count":(\d+)/,
  ];

  // Twitter/X: look for tweet count in meta tags or JSON
  const postCountPatterns = [
    /"statuses_count":(\d+)/,
    /(\d[\d,]*)\s*[Tt]weets/,
    /(\d[\d,]*)\s*[Pp]osts/,
  ];
  const post_count_last_30d = result.ok ? extractNumber(result.html, postCountPatterns) : null;

  // Twitter: engagement not available without API
  return {
    platform: "twitter",
    url,
    exists: result.ok && result.status !== 404,
    is_verified: /"verified":true/.test(result.html),
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d,
    avg_engagement_rate: null,
    last_post_date: null,
    bio_complete: result.ok && result.html.length > 3000,
  };
}

export async function scrapeYouTube(url: string): Promise<SocialChannelAudit> {
  const result = await fetchWithTimeout(url);
  const followerPatterns = [
    /(\d[\d,\.]+[KkMm]?)\s*[Ss]ubscriber/,
    /"subscriberCountText":\{"simpleText":"([^"]+)"\}/,
  ];

  // YouTube: look for video count in page HTML
  const postCountPatterns = [
    /"videoCountText":\{"runs":\[\{"text":"(\d[\d,]*)"/,
    /(\d[\d,]*)\s*[Vv]ideos/,
    /"videoCount":"(\d+)"/,
  ];
  const post_count_last_30d = result.ok ? extractNumber(result.html, postCountPatterns) : null;

  // YouTube: engagement (likes/comments) not publicly scraped — leave null
  return {
    platform: "youtube",
    url,
    exists: result.ok && result.status !== 404,
    is_verified: /"isVerified":true/.test(result.html),
    follower_count: result.ok ? extractNumber(result.html, followerPatterns) : null,
    post_count_last_30d,
    avg_engagement_rate: null,
    last_post_date: null,
    bio_complete: result.ok && result.html.length > 3000,
  };
}

/**
 * Derive channel presence from stored social_links without making HTTP requests.
 * Social media platforms block unauthenticated server-side fetching, so we
 * treat any non-null URL as confirmed presence and leave metrics as null.
 */
export function buildChannelsFromLinks(socialLinks: SocialLinks): SocialChannelAudit[] {
  const platforms = ["facebook", "instagram", "linkedin", "tiktok", "twitter", "youtube"] as const;
  return platforms
    .filter(p => socialLinks[p] !== null)
    .map(p => ({
      platform: p,
      url: socialLinks[p]!,
      exists: true,
      is_verified: false,
      follower_count: null,
      post_count_last_30d: null,
      avg_engagement_rate: null,
      last_post_date: null,
      bio_complete: false,
    }));
}

export async function scrapeSocialProfiles(socialLinks: SocialLinks): Promise<SocialChannelAudit[]> {
  const tasks: Promise<SocialChannelAudit>[] = [];

  if (socialLinks.facebook) tasks.push(scrapeFacebook(socialLinks.facebook));
  if (socialLinks.instagram) tasks.push(scrapeInstagram(socialLinks.instagram));
  if (socialLinks.linkedin) tasks.push(scrapeLinkedIn(socialLinks.linkedin));
  if (socialLinks.tiktok) tasks.push(scrapeTikTok(socialLinks.tiktok));
  if (socialLinks.twitter) tasks.push(scrapeTwitter(socialLinks.twitter));
  if (socialLinks.youtube) tasks.push(scrapeYouTube(socialLinks.youtube));

  return Promise.all(tasks);
}


export interface PlatformBenchmark {
  platform: string;
  importance: "critical" | "important" | "useful";
}

/**
 * Keyword → benchmark map.
 * Each entry's key is a keyword that is checked via case-insensitive `includes`
 * against the business category string. First match wins.
 */
const BENCHMARK_KEYWORD_MAP: Array<{ keywords: string[]; benchmarks: PlatformBenchmark[] }> = [
  {
    keywords: ["restaurant", "food", "cafe"],
    benchmarks: [
      { platform: "instagram", importance: "critical" },
      { platform: "facebook", importance: "critical" },
      { platform: "tiktok", importance: "important" },
      { platform: "twitter", importance: "useful" },
    ],
  },
  {
    keywords: ["salon", "beauty", "spa"],
    benchmarks: [
      { platform: "instagram", importance: "critical" },
      { platform: "tiktok", importance: "critical" },
      { platform: "facebook", importance: "important" },
    ],
  },
  {
    keywords: ["retail", "shop", "store"],
    benchmarks: [
      { platform: "instagram", importance: "critical" },
      { platform: "facebook", importance: "critical" },
      { platform: "tiktok", importance: "important" },
      { platform: "pinterest", importance: "useful" },
    ],
  },
  {
    keywords: ["law", "legal", "attorney"],
    benchmarks: [
      { platform: "linkedin", importance: "critical" },
      { platform: "facebook", importance: "important" },
      { platform: "twitter", importance: "useful" },
    ],
  },
  {
    keywords: ["medical", "dental", "health", "clinic"],
    benchmarks: [
      { platform: "facebook", importance: "critical" },
      { platform: "instagram", importance: "important" },
      { platform: "linkedin", importance: "useful" },
    ],
  },
  {
    keywords: ["real_estate", "property"],
    benchmarks: [
      { platform: "facebook", importance: "critical" },
      { platform: "instagram", importance: "important" },
      { platform: "linkedin", importance: "important" },
      { platform: "youtube", importance: "useful" },
    ],
  },
  {
    keywords: ["gym", "fitness", "sport"],
    benchmarks: [
      { platform: "instagram", importance: "critical" },
      { platform: "tiktok", importance: "important" },
      { platform: "facebook", importance: "important" },
      { platform: "youtube", importance: "useful" },
    ],
  },
  {
    keywords: ["hotel", "accommodation", "lodge"],
    benchmarks: [
      { platform: "instagram", importance: "critical" },
      { platform: "facebook", importance: "critical" },
      { platform: "twitter", importance: "useful" },
    ],
  },
  {
    keywords: ["construction", "contractor"],
    benchmarks: [
      { platform: "facebook", importance: "important" },
      { platform: "linkedin", importance: "important" },
      { platform: "instagram", importance: "useful" },
    ],
  },
  {
    keywords: ["education", "school", "training"],
    benchmarks: [
      { platform: "facebook", importance: "important" },
      { platform: "linkedin", importance: "important" },
      { platform: "youtube", importance: "important" },
      { platform: "instagram", importance: "useful" },
    ],
  },
  {
    keywords: ["tech", "software", "it"],
    benchmarks: [
      { platform: "linkedin", importance: "critical" },
      { platform: "twitter", importance: "important" },
      { platform: "youtube", importance: "useful" },
    ],
  },
];

const DEFAULT_BENCHMARKS: PlatformBenchmark[] = [
  { platform: "facebook", importance: "important" },
  { platform: "instagram", importance: "important" },
  { platform: "linkedin", importance: "useful" },
];

export function getIndustryBenchmarks(category: string): PlatformBenchmark[] {
  const normalized = category.toLowerCase();
  for (const entry of BENCHMARK_KEYWORD_MAP) {
    if (entry.keywords.some(kw => normalized.includes(kw))) {
      return entry.benchmarks;
    }
  }
  return DEFAULT_BENCHMARKS;
}


export interface SocialScores {
  platformCoverageScore: number;
  engagementScore: number;
  missingPlatforms: string[];
}

export function calculateSocialScores(channels: SocialChannelAudit[], category: string): SocialScores {
  const benchmarks = getIndustryBenchmarks(category);
  const presentPlatforms = new Set(channels.filter(c => c.exists).map(c => c.platform));

  const critical = benchmarks.filter(b => b.importance === "critical");
  const important = benchmarks.filter(b => b.importance === "important");
  const useful = benchmarks.filter(b => b.importance === "useful");

  const criticalPresent = critical.filter(b => presentPlatforms.has(b.platform)).length;
  const importantPresent = important.filter(b => presentPlatforms.has(b.platform)).length;
  const usefulPresent = useful.filter(b => presentPlatforms.has(b.platform)).length;

  // Fixed-point scoring: +60 split across critical, +30 across important, +10 across useful
  const criticalScore = critical.length > 0
    ? (criticalPresent / critical.length) * 60
    : 60; // no critical platforms defined → full credit
  const importantScore = important.length > 0
    ? (importantPresent / important.length) * 30
    : 30;
  const usefulScore = useful.length > 0
    ? (usefulPresent / useful.length) * 10
    : 10;

  const platformCoverageScore = Math.min(100, Math.round(criticalScore + importantScore + usefulScore));

  // Engagement: based on follower count, bio completeness, and post activity
  const activeChannels = channels.filter(c => c.exists);
  let engagementScore = 0;
  if (activeChannels.length > 0) {
    const channelScores = activeChannels.map(c => {
      let score = 0;
      if (c.bio_complete) score += 30;
      if (c.follower_count !== null) {
        if (c.follower_count >= 1000) score += 40;
        else if (c.follower_count >= 100) score += 20;
        else score += 5;
      }
      if (c.avg_engagement_rate !== null) {
        // Bonus for measured engagement: industry average ~1-3%
        if (c.avg_engagement_rate >= 3) score += 30;
        else if (c.avg_engagement_rate >= 1) score += 20;
        else score += 5;
      } else if (c.post_count_last_30d !== null && c.post_count_last_30d > 0) {
        score += 20;
      } else {
        score += 10; // partial credit when we can't scrape activity
      }
      return Math.min(score, 100);
    });
    engagementScore = Math.round(channelScores.reduce((a, b) => a + b, 0) / channelScores.length);
  }

  const missingPlatforms = [
    ...critical.filter(b => !presentPlatforms.has(b.platform)).map(b => b.platform),
    ...important.filter(b => !presentPlatforms.has(b.platform)).map(b => b.platform),
  ];

  return { platformCoverageScore, engagementScore, missingPlatforms };
}
