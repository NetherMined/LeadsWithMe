-- Migration 010: Audit Enhancements — tech stack detail, external deals, competitors

ALTER TABLE website_audits
  ADD COLUMN IF NOT EXISTS tech_stack_detailed JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_deals      JSONB NOT NULL DEFAULT '[]';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS competitors JSONB;
