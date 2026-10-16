-- 008_api_usage.sql
-- Track API calls per user for free-tier monitoring

CREATE TABLE IF NOT EXISTS api_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service        TEXT NOT NULL,   -- google-places, anthropic, gemini, pagespeed
  operation      TEXT NOT NULL,   -- text-search, place-details, autocomplete, completion, pagespeed
  estimated_cost NUMERIC(10,6)    NOT NULL DEFAULT 0,
  tokens_input   INTEGER,
  tokens_output  INTEGER,
  metadata       JSONB            NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Fast lookup by user + time
CREATE INDEX IF NOT EXISTS idx_api_usage_user_time
  ON api_usage(user_id, created_at DESC);

-- Fast lookup by user + service + time (for per-service aggregation)
CREATE INDEX IF NOT EXISTS idx_api_usage_user_service_time
  ON api_usage(user_id, service, created_at DESC);

-- RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own api_usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts go through service role only (no direct client inserts)
