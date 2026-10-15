-- 007_search_sets.sql
-- Saved search sets: allow users to name and re-run a search query+location pair

CREATE TABLE IF NOT EXISTS search_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  limit_count INTEGER NOT NULL DEFAULT 20,
  last_run_at TIMESTAMPTZ,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_search_sets_user_id ON search_sets(user_id);

-- RLS
ALTER TABLE search_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own search sets"
  ON search_sets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
