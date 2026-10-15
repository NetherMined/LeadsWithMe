// src/types/business.ts

export interface CompetitorInfo {
  place_id: string;
  name: string;
  rating: number | null;
  review_count: number;
  website: string | null;
  address: string;
  phone: string | null;
}

export interface BusinessReview {
  author_name: string;
  author_photo_url: string | null;
  author_profile_url: string | null;
  author_review_count: number | null;
  author_is_local_guide: boolean;
  rating: number;
  relative_time: string;
  text: string;
  reaction_count: number | null;
}

export interface BusinessProduct {
  name: string;
  category: string | null;
  price: string | null;
  image_url: string | null;
}

export interface RelatedBusiness {
  name: string;
  category: string | null;
  image_url: string | null;
}

export interface ReviewTopic {
  topic: string;
  count: number;
}

export interface WebResult {
  source: string;
  url: string;
  snippet: string | null;
}

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
}

export interface Business {
  id: string;

  // Core identity (Google Places)
  place_id: string;
  name: string;
  address: string;
  address_street: string | null;
  address_suburb: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  feature_id: string | null;

  // Contact
  phone: string | null;
  mobile: string | null;
  email: string | null;
  emails: string[] | null;
  whatsapp: string | null;
  website: string | null;

  // Category & search
  category: string;
  search_term: string | null;
  description: string | null;

  // Ratings & reviews
  rating: number | null;
  review_count: number;
  rating_distribution: Record<string, number> | null;
  reviews: BusinessReview[] | null;

  // Open status & hours
  is_open_now: boolean | null;
  current_status: string | null;
  hours: string[] | null;           // weekday_text strings ("Monday: 9–5 PM")
  hours_weekly: Record<string, { open: string; close: string } | string> | null;

  // Photos & media
  photo_count: number | null;
  photos: string[] | null;
  photo_primary: string | null;
  photo_references: string[] | null;

  // Social
  social_links: SocialLinks;
  social_channel_count: number | null;

  // Products & services
  products: BusinessProduct[] | null;
  services_url: string | null;
  appointments_url: string | null;

  // Business profile extras
  has_updates: boolean | null;
  updates_url: string | null;

  // Popular times (Knowledge Panel scrape)
  popular_times: Record<string, Record<string, number>> | null;
  live_busyness: string | null;
  typical_visit_duration: string | null;

  // Service area
  service_area_primary: string | null;
  service_areas: string[] | null;

  // Related businesses & topics (Knowledge Panel)
  related_businesses: RelatedBusiness[] | null;
  review_topics: ReviewTopic[] | null;
  web_results: WebResult[] | null;

  // Ownership
  is_claimed: boolean | null;
  gmb_claim_url: string | null;

  // Competitors
  competitors: CompetitorInfo[] | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  user_id: string;

  // Staleness indicator (populated during search if stale_only filter is used)
  is_stale?: boolean | null;
}

export interface SearchSet {
  id: string;
  user_id: string;
  name: string;
  query: string;
  location: string;
  country: string;
  limit_count: number;
  last_run_at: string | null;
  result_count: number;
  created_at: string;
  updated_at: string;
}
