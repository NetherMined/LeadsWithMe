-- 001_create_tables.sql

-- Businesses (leads)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  category TEXT NOT NULL,
  rating NUMERIC(3,1),
  review_count INTEGER NOT NULL DEFAULT 0,
  latitude NUMERIC(10,7) NOT NULL DEFAULT 0,
  longitude NUMERIC(10,7) NOT NULL DEFAULT 0,
  social_links JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Website audits
CREATE TABLE IF NOT EXISTS website_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  performance_score INTEGER NOT NULL DEFAULT 0,
  seo_score INTEGER NOT NULL DEFAULT 0,
  accessibility_score INTEGER NOT NULL DEFAULT 0,
  mobile_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  has_ssl BOOLEAN NOT NULL DEFAULT FALSE,
  has_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  cms_detected TEXT,
  page_speed_ms INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  h1_count INTEGER NOT NULL DEFAULT 0,
  has_sitemap BOOLEAN NOT NULL DEFAULT FALSE,
  has_blog BOOLEAN NOT NULL DEFAULT FALSE,
  blog_last_post_date TIMESTAMPTZ,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social audits
CREATE TABLE IF NOT EXISTS social_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channels JSONB NOT NULL DEFAULT '[]',
  platform_coverage_score INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  missing_platforms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ads audits
CREATE TABLE IF NOT EXISTS ads_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  has_meta_ads BOOLEAN NOT NULL DEFAULT FALSE,
  meta_ad_count INTEGER NOT NULL DEFAULT 0,
  has_google_ads BOOLEAN NOT NULL DEFAULT FALSE,
  domain_authority INTEGER,
  backlink_estimate INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scores
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'F',
  label TEXT NOT NULL DEFAULT 'Digital Absent',
  website_score INTEGER NOT NULL DEFAULT 0,
  social_score INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  advertising_score INTEGER NOT NULL DEFAULT 0,
  reviews_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Marketing plans
CREATE TABLE IF NOT EXISTS marketing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  executive_summary TEXT NOT NULL,
  website_recommendations JSONB NOT NULL DEFAULT '{}',
  social_recommendations JSONB NOT NULL DEFAULT '{}',
  advertising_recommendations JSONB NOT NULL DEFAULT '{}',
  quick_wins JSONB NOT NULL DEFAULT '[]',
  medium_term JSONB NOT NULL DEFAULT '[]',
  long_term JSONB NOT NULL DEFAULT '[]',
  outreach_email_draft TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used TEXT NOT NULL DEFAULT 'claude-haiku-4-5'
);

-- Export records
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sheets', 'docs', 'drive')),
  google_file_id TEXT NOT NULL,
  google_file_url TEXT NOT NULL,
  business_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Google OAuth tokens (per user)
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
