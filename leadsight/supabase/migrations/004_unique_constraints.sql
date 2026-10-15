-- 004_unique_constraints.sql
-- Add unique constraints on business_id so upsert onConflict works

ALTER TABLE website_audits ADD CONSTRAINT website_audits_business_id_key UNIQUE (business_id);
ALTER TABLE social_audits  ADD CONSTRAINT social_audits_business_id_key  UNIQUE (business_id);
ALTER TABLE ads_audits     ADD CONSTRAINT ads_audits_business_id_key      UNIQUE (business_id);
ALTER TABLE scores         ADD CONSTRAINT scores_business_id_key          UNIQUE (business_id);
ALTER TABLE marketing_plans ADD CONSTRAINT marketing_plans_business_id_key UNIQUE (business_id);
