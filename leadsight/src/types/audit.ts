// src/types/audit.ts

export interface TechStackDetailed {
  platforms: string[];
  analytics: string[];
  advertising: string[];
  payment: string[];
  email_marketing: string[];
  customer_support: string[];
  hosting_cdn: string[];
  social_proof: string[];
  booking: string[];
}

export interface ExternalDealResult {
  site: string;
  url: string;
  found: boolean;
}

export interface WebsiteAudit {
  id: string;
  business_id: string;

  // PageSpeed scores
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  page_speed_ms: number;

  // Basic checks
  has_ssl: boolean;
  mobile_friendly: boolean;
  mobile_viewport: boolean;
  has_analytics: boolean;
  cms_detected: string | null;
  tech_stack: string[];

  // SEO
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  h1_count: number;
  has_sitemap: boolean;
  has_robots_txt: boolean;
  structured_data: boolean;
  canonical_url: string | null;
  open_graph_tags: boolean;

  // Enhanced tech
  tech_stack_detailed: TechStackDetailed;
  external_deals: ExternalDealResult[];

  // Content
  has_blog: boolean;
  blog_last_post_date: string | null;
  has_deals: boolean;
  deals_keywords: string[];

  // Widgets & consent
  has_chat_widget: boolean;
  has_cookie_consent: boolean;

  // Contact
  contact_emails: string[];

  created_at: string;
}

export interface SocialAudit {
  id: string;
  business_id: string;
  channels: SocialChannelAudit[];
  platform_coverage_score: number;
  engagement_score: number;
  missing_platforms: string[];
  created_at: string;
}

export interface SocialChannelAudit {
  platform: string;
  url: string;
  exists: boolean;
  is_verified: boolean;
  follower_count: number | null;
  post_count_last_30d: number | null;
  avg_engagement_rate: number | null;
  last_post_date: string | null;
  bio_complete: boolean;
}

export interface AdsAudit {
  id: string;
  business_id: string;
  has_meta_ads: boolean;
  meta_ad_count: number;
  meta_ad_categories: string[];
  has_google_ads: boolean;
  has_remarketing_pixel: boolean;
  domain_authority: number | null;
  backlink_estimate: number | null;
  created_at: string;
}
