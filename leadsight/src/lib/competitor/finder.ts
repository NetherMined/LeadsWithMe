// src/lib/competitor/finder.ts
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, scores } from "@/lib/db/schema";
import type { Business } from "@/types/business";

const EARTH_RADIUS_KM = 6371;
const MAX_RADIUS_KM = 5;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the top competitor for a business.
 * Strategy 1: Query the owner's same-category businesses within 5km, pick highest score.
 * Strategy 2: Fall back to business.competitors[] sorted by rating × review_count.
 * Returns null if no suitable competitor found.
 */
export async function findTopCompetitor(business: Business): Promise<Business | null> {
  // Strategy 1: Query our own DB for scored businesses in same category
  const candidates = (await db
    .select()
    .from(businesses)
    .where(
      and(
        eq(businesses.user_id, business.user_id),
        eq(businesses.category, business.category),
        ne(businesses.id, business.id),
        isNotNull(businesses.website)
      )
    )) as unknown as Business[];

  if (candidates && candidates.length > 0) {
    // Filter to 5km radius
    const nearby = candidates.filter(c => {
      if (!c.latitude || !c.longitude) return false;
      return haversineKm(business.latitude, business.longitude, c.latitude, c.longitude) <= MAX_RADIUS_KM;
    });

    if (nearby.length > 0) {
      // Fetch scores for nearby businesses
      const nearbyIds = nearby.map(b => b.id);
      const nearbyScores = await db
        .select({ business_id: scores.business_id, total_score: scores.total_score })
        .from(scores)
        .where(inArray(scores.business_id, nearbyIds));

      const scoreMap = new Map(nearbyScores.map(s => [s.business_id, s.total_score]));

      // Sort by score desc, then rating × review_count
      const sorted = nearby.sort((a, b) => {
        const scoreA = scoreMap.get(a.id) ?? 0;
        const scoreB = scoreMap.get(b.id) ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.rating ?? 0) * b.review_count - (a.rating ?? 0) * a.review_count;
      });

      return sorted[0];
    }
  }

  // Strategy 2: Use business.competitors[] as fallback
  const competitors = business.competitors ?? [];
  const withWebsite = competitors.filter(c => c.website);
  if (withWebsite.length === 0) return null;

  // Pick highest rating × review_count
  const best = withWebsite.sort(
    (a, b) => (b.rating ?? 0) * b.review_count - (a.rating ?? 0) * a.review_count
  )[0];

  // Build a minimal Business object from CompetitorInfo
  return {
    id: best.place_id,
    place_id: best.place_id,
    name: best.name,
    address: best.address,
    address_street: null,
    address_suburb: null,
    address_city: null,
    address_postal_code: null,
    address_country: null,
    latitude: business.latitude,
    longitude: business.longitude,
    google_maps_url: null,
    feature_id: null,
    phone: best.phone,
    mobile: null,
    email: null,
    emails: null,
    whatsapp: null,
    website: best.website,
    category: business.category,
    search_term: null,
    description: null,
    rating: best.rating,
    review_count: best.review_count,
    rating_distribution: null,
    reviews: null,
    is_open_now: null,
    current_status: null,
    hours: null,
    hours_weekly: null,
    photo_count: null,
    photos: null,
    photo_primary: null,
    photo_references: null,
    social_links: { facebook: null, instagram: null, linkedin: null, tiktok: null, twitter: null, youtube: null },
    social_channel_count: null,
    products: null,
    services_url: null,
    appointments_url: null,
    has_updates: null,
    updates_url: null,
    popular_times: null,
    live_busyness: null,
    typical_visit_duration: null,
    service_area_primary: null,
    service_areas: null,
    related_businesses: null,
    review_topics: null,
    web_results: null,
    is_claimed: null,
    gmb_claim_url: null,
    competitors: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: "",
  } as Business;
}
