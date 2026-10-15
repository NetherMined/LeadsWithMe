-- 003_indexes.sql
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON businesses(place_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_website_audits_business_id ON website_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_social_audits_business_id ON social_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_ads_audits_business_id ON ads_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_scores_business_id ON scores(business_id);
CREATE INDEX IF NOT EXISTS idx_scores_total_score ON scores(total_score);
CREATE INDEX IF NOT EXISTS idx_marketing_plans_business_id ON marketing_plans(business_id);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_user_id ON user_google_tokens(user_id);
