-- Migration: Add demo_site_url column and make html nullable
-- Run this against your Supabase database

ALTER TABLE public.proposal_demos
  ADD COLUMN IF NOT EXISTS demo_site_url text;

ALTER TABLE public.proposal_demos
  ALTER COLUMN html DROP NOT NULL;
