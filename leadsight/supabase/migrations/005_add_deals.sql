-- 005_add_deals.sql
-- Add deals/specials detection columns to website_audits
ALTER TABLE website_audits
  ADD COLUMN IF NOT EXISTS has_deals BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deals_keywords TEXT[] NOT NULL DEFAULT '{}';
