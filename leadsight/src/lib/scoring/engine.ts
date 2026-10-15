import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";
import type { DigitalPresenceScore } from "@/types/score";

export function calculateDigitalPresenceScore(
  businessId: string,
  websiteAudit: WebsiteAudit | null,
  socialAudit: SocialAudit | null,
  adsAudit: AdsAudit | null,
  reviewRating: number | null,
  reviewCount: number
): DigitalPresenceScore {

  // === WEBSITE SCORE (weight: 30%) ===
  let websiteScore = 0;
  if (websiteAudit) {
    const base = Math.round(
      (websiteAudit.performance_score + websiteAudit.seo_score + websiteAudit.accessibility_score) / 3
    );
    let bonus = 0;
    if (websiteAudit.has_ssl) bonus += 5;
    if (websiteAudit.mobile_friendly) bonus += 5;
    if (websiteAudit.has_blog && websiteAudit.blog_last_post_date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(websiteAudit.blog_last_post_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < 30) bonus += 10;
    }
    websiteScore = Math.min(base + bonus, 100);
  }

  // === SOCIAL PRESENCE SCORE (weight: 25%) ===
  const socialScore = socialAudit?.platform_coverage_score ?? 0;

  // === ENGAGEMENT SCORE (weight: 20%) ===
  const engagementScore = socialAudit?.engagement_score ?? 0;

  // === ADVERTISING SCORE (weight: 15%) ===
  let advertisingScore = 20; // base: 20 for having a website (or existence)
  if (adsAudit) {
    if (adsAudit.has_meta_ads) advertisingScore += 30;
    if (adsAudit.has_google_ads) advertisingScore += 20;
    if (adsAudit.domain_authority !== null) {
      advertisingScore += Math.round((adsAudit.domain_authority / 100) * 30);
    }
    advertisingScore = Math.min(advertisingScore, 100);
  }

  // === REVIEWS SCORE (weight: 10%) ===
  let reviewsScore = 0;
  if (reviewRating !== null && reviewRating > 0) {
    const ratingComponent = (reviewRating / 5) * 60;
    const countComponent = Math.min(reviewCount / 100, 1) * 40;
    reviewsScore = Math.round(ratingComponent + countComponent);
  }

  // === COMPOSITE SCORE ===
  const totalScore = Math.round(
    websiteScore * 0.30 +
    socialScore * 0.25 +
    engagementScore * 0.20 +
    advertisingScore * 0.15 +
    reviewsScore * 0.10
  );

  // === GRADE ===
  const grade: "A" | "B" | "C" | "D" | "F" =
    totalScore >= 80 ? "A" :
    totalScore >= 60 ? "B" :
    totalScore >= 40 ? "C" :
    totalScore >= 20 ? "D" : "F";

  const label =
    grade === "A" ? "Digital Leader" :
    grade === "B" ? "Strong Online Presence" :
    grade === "C" ? "Growing Online" :
    grade === "D" ? "Needs Attention" : "Digital Ghost";

  return {
    id: crypto.randomUUID(),
    business_id: businessId,
    total_score: totalScore,
    grade,
    label,
    website_score: websiteScore,
    social_score: socialScore,
    engagement_score: engagementScore,
    advertising_score: advertisingScore,
    reviews_score: reviewsScore,
    created_at: new Date().toISOString(),
  };
}

/**
 * Calculate outreach priority score based on digital presence gap and business signals.
 * Targets businesses in 40–65 total_score range with strong engagement indicators.
 */
export function calculateOutreachPriorityScore(
  totalScore: number,
  business: {
    rating?: number | null;
    review_count?: number | null;
    is_claimed?: boolean | null;
  },
  hasDeals?: boolean | null
): {
  outreach_priority_score: number;
  outreach_priority_reason: string;
} {
  // Start with gap: (100 - total_score)
  const gap = 100 - totalScore;

  // Build signal multiplier
  let signalMultiplier = 1.0;
  const signals: string[] = [];

  // ✓ High rating (4.0+): quality-conscious business
  if (business.rating !== null && business.rating !== undefined && business.rating >= 4.0) {
    signalMultiplier *= 1.3;
    signals.push("high rating");
  }

  // ✓ Many reviews (50+): established, has revenue
  if (business.review_count !== null && business.review_count !== undefined && business.review_count >= 50) {
    signalMultiplier *= 1.3;
    signals.push("many reviews");
  }

  // ✓ Claimed business: engaged owner, will reply
  if (business.is_claimed === true) {
    signalMultiplier *= 1.5;
    signals.push("engaged owner");
  }

  // ✗ Already digital leader: don't target
  if (totalScore >= 80) {
    signalMultiplier *= 0.5;
    signals.push("already strong");
  }

  // ✗ Likely abandoned: skip
  if (totalScore < 20) {
    signalMultiplier *= 0.3;
    signals.push("likely abandoned");
  }

  // ✓ Has deals: marketing-aware
  if (hasDeals === true) {
    signalMultiplier *= 1.4;
    signals.push("marketing-aware");
  }

  // Calculate final score
  const outreachScore = gap * signalMultiplier;
  const roundedScore = Math.min(Math.round(outreachScore * 10) / 10, 100);

  // Generate reason from signals
  const reason = signals.length > 0 ? signals.join(" + ") : "moderate potential";

  return {
    outreach_priority_score: roundedScore,
    outreach_priority_reason: reason,
  };
}

/**
 * Get human-readable label for outreach priority score.
 */
export function getOutreachPriorityLabel(score: number): string {
  if (score >= 70) return "Prime Target";
  if (score >= 50) return "Good Target";
  if (score >= 30) return "Possible Target";
  return "Low Priority";
}
