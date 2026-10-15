-- Migration 009: Add DATA-REFERENCE.md fields
-- Adds all fields defined in DATA-REFERENCE.md that were not previously in the schema

-- ─── businesses table ────────────────────────────────────────────────────────

ALTER TABLE businesses
  -- Parsed address components
  ADD COLUMN IF NOT EXISTS address_street        TEXT,
  ADD COLUMN IF NOT EXISTS address_suburb        TEXT,
  ADD COLUMN IF NOT EXISTS address_city          TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code   TEXT,
  ADD COLUMN IF NOT EXISTS address_country       TEXT,

  -- Google Maps URL and feature ID
  ADD COLUMN IF NOT EXISTS google_maps_url       TEXT,
  ADD COLUMN IF NOT EXISTS feature_id            TEXT,

  -- Ratings & reviews
  ADD COLUMN IF NOT EXISTS rating_distribution   JSONB,
  ADD COLUMN IF NOT EXISTS reviews               JSONB,

  -- Open status & structured hours
  ADD COLUMN IF NOT EXISTS is_open_now           BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_status        TEXT,
  ADD COLUMN IF NOT EXISTS hours_weekly          JSONB,

  -- Photos & media
  ADD COLUMN IF NOT EXISTS photo_count           INTEGER,
  ADD COLUMN IF NOT EXISTS photos                JSONB,
  ADD COLUMN IF NOT EXISTS photo_primary         TEXT,
  ADD COLUMN IF NOT EXISTS photo_references      JSONB,

  -- Social channel count
  ADD COLUMN IF NOT EXISTS social_channel_count  INTEGER,

  -- Products & services
  ADD COLUMN IF NOT EXISTS products              JSONB,
  ADD COLUMN IF NOT EXISTS services_url          TEXT,
  ADD COLUMN IF NOT EXISTS appointments_url      TEXT,

  -- Business description & updates
  ADD COLUMN IF NOT EXISTS description           TEXT,
  ADD COLUMN IF NOT EXISTS has_updates           BOOLEAN,
  ADD COLUMN IF NOT EXISTS updates_url           TEXT,

  -- Popular times (Knowledge Panel scrape — stub, populated separately)
  ADD COLUMN IF NOT EXISTS popular_times         JSONB,
  ADD COLUMN IF NOT EXISTS live_busyness         TEXT,
  ADD COLUMN IF NOT EXISTS typical_visit_duration TEXT,

  -- Service area
  ADD COLUMN IF NOT EXISTS service_area_primary  TEXT,
  ADD COLUMN IF NOT EXISTS service_areas         JSONB,

  -- Related businesses & review topics (Knowledge Panel)
  ADD COLUMN IF NOT EXISTS related_businesses    JSONB,
  ADD COLUMN IF NOT EXISTS review_topics         JSONB,
  ADD COLUMN IF NOT EXISTS web_results           JSONB,

  -- Ownership
  ADD COLUMN IF NOT EXISTS is_claimed            BOOLEAN,
  ADD COLUMN IF NOT EXISTS gmb_claim_url         TEXT;

-- ─── website_audits table ────────────────────────────────────────────────────

ALTER TABLE website_audits
  ADD COLUMN IF NOT EXISTS has_chat_widget       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_cookie_consent    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS og_image              TEXT,
  ADD COLUMN IF NOT EXISTS has_robots_txt        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_viewport       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_emails        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS structured_data       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_url         TEXT,
  ADD COLUMN IF NOT EXISTS open_graph_tags       BOOLEAN NOT NULL DEFAULT false;

-- ─── ads_audits table ────────────────────────────────────────────────────────

ALTER TABLE ads_audits
  ADD COLUMN IF NOT EXISTS meta_ad_categories    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS has_remarketing_pixel BOOLEAN NOT NULL DEFAULT false;
