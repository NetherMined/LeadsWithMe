-- 011_outreach_pipeline.sql
-- Outreach workflow tables: assets, pipeline, and proof snapshots

CREATE TABLE IF NOT EXISTS outreach_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  loom_script text,
  email_subject text,
  email_body text,
  linkedin_connect_note text,
  linkedin_followup text,
  flat_fee_amount numeric(10,2),
  flat_fee_currency text DEFAULT 'GBP',
  delivery_days int DEFAULT 5,
  identified_issues jsonb DEFAULT '[]',
  loom_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_contacted',
  channel text DEFAULT 'email',
  first_contact_at timestamptz,
  last_contact_at timestamptz,
  reply_received_at timestamptz,
  outcome_notes text,
  won_amount numeric,
  lost_reason text,
  next_followup_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id)
);

CREATE TABLE IF NOT EXISTS proof_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('before', 'after')),
  pagespeed_mobile int,
  pagespeed_desktop int,
  seo_score int,
  accessibility_score int,
  screenshot_url text,
  notes text,
  captured_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE outreach_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users own their own rows
CREATE POLICY "users_own_outreach_assets" ON outreach_assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_outreach_pipeline" ON outreach_pipeline FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_proof_snapshots" ON proof_snapshots FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_outreach_assets_business_id ON outreach_assets(business_id);
CREATE INDEX idx_outreach_assets_user_id ON outreach_assets(user_id);
CREATE INDEX idx_outreach_pipeline_user_id ON outreach_pipeline(user_id);
CREATE INDEX idx_outreach_pipeline_status ON outreach_pipeline(status);
CREATE INDEX idx_outreach_pipeline_next_followup ON outreach_pipeline(next_followup_at);
CREATE INDEX idx_proof_snapshots_business_id ON proof_snapshots(business_id);
CREATE INDEX idx_proof_snapshots_user_id ON proof_snapshots(user_id);
