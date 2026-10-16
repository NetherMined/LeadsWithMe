-- 006_enrich_fields.sql
-- Add enriched contact fields to businesses table

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emails JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS hours JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS search_term TEXT;
