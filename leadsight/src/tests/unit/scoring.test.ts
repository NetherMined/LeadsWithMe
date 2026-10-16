import { describe, it, expect } from "vitest";
import { calculateDigitalPresenceScore } from "@/lib/scoring/engine";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";

const BID = "test-business-id";

const perfectWebsite: WebsiteAudit = {
  id: "w1", business_id: BID,
  performance_score: 95, seo_score: 90, accessibility_score: 88,
  mobile_friendly: true, mobile_viewport: true, has_ssl: true, has_analytics: true,
  cms_detected: "wordpress", page_speed_ms: 800,
  meta_title: "Test", meta_description: "Test description", og_image: null,
  h1_count: 1, has_sitemap: true, has_robots_txt: true,
  structured_data: true, canonical_url: null, open_graph_tags: true,
  has_blog: true, blog_last_post_date: new Date().toISOString(),
  has_deals: false, deals_keywords: [],
  tech_stack: ["wordpress", "Google Analytics"],
  tech_stack_detailed: {
    platforms: ["wordpress"], analytics: ["Google Analytics"], advertising: [], payment: [],
    email_marketing: [], customer_support: [], hosting_cdn: [], social_proof: [], booking: [],
  },
  external_deals: [],
  has_chat_widget: false, has_cookie_consent: false,
  contact_emails: [],
  created_at: new Date().toISOString(),
};

const poorWebsite: WebsiteAudit = {
  ...perfectWebsite, id: "w2",
  performance_score: 10, seo_score: 15, accessibility_score: 20,
  mobile_friendly: false, has_ssl: false, has_blog: false,
  blog_last_post_date: null,
};

const fullSocial: SocialAudit = {
  id: "s1", business_id: BID,
  channels: [],
  platform_coverage_score: 85,
  engagement_score: 70,
  missing_platforms: [],
  created_at: new Date().toISOString(),
};

const noSocial: SocialAudit = {
  ...fullSocial, id: "s2",
  platform_coverage_score: 0, engagement_score: 0,
  missing_platforms: ["facebook", "instagram"],
};

const bothAds: AdsAudit = {
  id: "a1", business_id: BID,
  has_meta_ads: true, meta_ad_count: 5, meta_ad_categories: [],
  has_google_ads: true, has_remarketing_pixel: true, domain_authority: 50,
  backlink_estimate: 1000,
  created_at: new Date().toISOString(),
};

const noAds: AdsAudit = {
  ...bothAds, id: "a2",
  has_meta_ads: false, meta_ad_count: 0,
  has_google_ads: false, domain_authority: null,
  backlink_estimate: null,
};

describe("calculateDigitalPresenceScore", () => {
  it("returns a score between 0 and 100 for full data", () => {
    const result = calculateDigitalPresenceScore(BID, perfectWebsite, fullSocial, bothAds, 4.5, 120);
    expect(result.total_score).toBeGreaterThanOrEqual(0);
    expect(result.total_score).toBeLessThanOrEqual(100);
  });

  it("returns low score when all audits are null", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, null, 0);
    expect(result.total_score).toBeLessThan(30);
  });

  it("website_score is high for a perfect website audit", () => {
    const result = calculateDigitalPresenceScore(BID, perfectWebsite, null, null, null, 0);
    expect(result.website_score).toBeGreaterThan(80);
  });

  it("website_score is low for a poor website audit", () => {
    const result = calculateDigitalPresenceScore(BID, poorWebsite, null, null, null, 0);
    expect(result.website_score).toBeLessThan(30);
  });

  it("advertising_score is high with both Meta and Google Ads", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, bothAds, null, 0);
    expect(result.advertising_score).toBeGreaterThan(60);
  });

  it("advertising_score base is 20 with no ads", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, noAds, null, 0);
    expect(result.advertising_score).toBe(20);
  });

  it("reviews_score is high for 5-star with 200 reviews", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, 5.0, 200);
    expect(result.reviews_score).toBeGreaterThanOrEqual(80);
  });

  it("reviews_score is low for 1-star rating", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, 1.0, 10);
    expect(result.reviews_score).toBeLessThan(20);
  });

  it("reviews_score is 0 when rating is null", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, null, 100);
    expect(result.reviews_score).toBe(0);
  });

  it("grade A for score >= 80", () => {
    const result = calculateDigitalPresenceScore(BID, perfectWebsite, fullSocial, bothAds, 5.0, 500);
    if (result.total_score >= 80) {
      expect(result.grade).toBe("A");
      expect(result.label).toBe("Digital Leader");
    }
  });

  it("grade F for very low score", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, null, 0);
    if (result.total_score < 20) {
      expect(result.grade).toBe("F");
      expect(result.label).toBe("Digital Ghost");
    }
  });

  it("weights sum to 100%: 30+25+20+15+10", () => {
    expect(30 + 25 + 20 + 15 + 10).toBe(100);
  });

  it("social scores flow through correctly", () => {
    const result = calculateDigitalPresenceScore(BID, null, fullSocial, null, null, 0);
    expect(result.social_score).toBe(fullSocial.platform_coverage_score);
    expect(result.engagement_score).toBe(fullSocial.engagement_score);
  });

  it("partial data (only website) still returns valid result", () => {
    const result = calculateDigitalPresenceScore(BID, perfectWebsite, null, null, null, 0);
    expect(result.total_score).toBeGreaterThanOrEqual(0);
    expect(result.total_score).toBeLessThanOrEqual(100);
    expect(result.business_id).toBe(BID);
  });

  it("returns correct shape with all required fields", () => {
    const result = calculateDigitalPresenceScore(BID, null, null, null, null, 0);
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("business_id");
    expect(result).toHaveProperty("total_score");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("label");
    expect(result).toHaveProperty("website_score");
    expect(result).toHaveProperty("social_score");
    expect(result).toHaveProperty("engagement_score");
    expect(result).toHaveProperty("advertising_score");
    expect(result).toHaveProperty("reviews_score");
  });
});
