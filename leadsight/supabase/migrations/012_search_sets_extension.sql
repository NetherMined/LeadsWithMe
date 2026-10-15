-- 012_search_sets_extension.sql
-- Extend search_sets with outreach targeting fields

ALTER TABLE search_sets ADD COLUMN IF NOT EXISTS positioning_profile_id uuid;
ALTER TABLE search_sets ADD COLUMN IF NOT EXISTS target_currency text DEFAULT 'GBP';
