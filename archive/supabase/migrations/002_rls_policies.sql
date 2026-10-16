-- 002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

-- businesses: direct user_id
CREATE POLICY "Users can view own businesses" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own businesses" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own businesses" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own businesses" ON businesses FOR DELETE USING (auth.uid() = user_id);

-- website_audits: via business_id join
CREATE POLICY "Users can view own website_audits" ON website_audits FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = website_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can insert own website_audits" ON website_audits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = website_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can update own website_audits" ON website_audits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = website_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can delete own website_audits" ON website_audits FOR DELETE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = website_audits.business_id AND businesses.user_id = auth.uid()));

-- social_audits: via business_id join
CREATE POLICY "Users can view own social_audits" ON social_audits FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = social_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can insert own social_audits" ON social_audits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = social_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can update own social_audits" ON social_audits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = social_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can delete own social_audits" ON social_audits FOR DELETE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = social_audits.business_id AND businesses.user_id = auth.uid()));

-- ads_audits: via business_id join
CREATE POLICY "Users can view own ads_audits" ON ads_audits FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = ads_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can insert own ads_audits" ON ads_audits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = ads_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can update own ads_audits" ON ads_audits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = ads_audits.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can delete own ads_audits" ON ads_audits FOR DELETE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = ads_audits.business_id AND businesses.user_id = auth.uid()));

-- scores: via business_id join
CREATE POLICY "Users can view own scores" ON scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = scores.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can insert own scores" ON scores FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = scores.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can update own scores" ON scores FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = scores.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can delete own scores" ON scores FOR DELETE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = scores.business_id AND businesses.user_id = auth.uid()));

-- marketing_plans: via business_id join
CREATE POLICY "Users can view own marketing_plans" ON marketing_plans FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = marketing_plans.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can insert own marketing_plans" ON marketing_plans FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = marketing_plans.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can update own marketing_plans" ON marketing_plans FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = marketing_plans.business_id AND businesses.user_id = auth.uid()));
CREATE POLICY "Users can delete own marketing_plans" ON marketing_plans FOR DELETE
  USING (EXISTS (SELECT 1 FROM businesses WHERE businesses.id = marketing_plans.business_id AND businesses.user_id = auth.uid()));

-- exports: direct user_id
CREATE POLICY "Users can view own exports" ON exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exports" ON exports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON exports FOR DELETE USING (auth.uid() = user_id);

-- user_google_tokens: direct user_id
CREATE POLICY "Users can view own google_tokens" ON user_google_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own google_tokens" ON user_google_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own google_tokens" ON user_google_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own google_tokens" ON user_google_tokens FOR DELETE USING (auth.uid() = user_id);
