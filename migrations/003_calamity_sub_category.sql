-- AgriDash: calamity type (sub-category) on commodity records
-- Run in Supabase SQL Editor after prior migrations.

ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS calamity_sub_category TEXT NOT NULL DEFAULT 'None';
