-- AgriDash: allow 'livestock' as a farmer_assets category.
-- Run in Supabase SQL Editor after migrations/007_farmer_assets.sql.

ALTER TABLE public.farmer_assets
  DROP CONSTRAINT IF EXISTS farmer_assets_category_check;

ALTER TABLE public.farmer_assets
  ADD CONSTRAINT farmer_assets_category_check
  CHECK (category IN (
    'planting_area', 'machinery', 'fishpond', 'facility', 'livestock'
  ));
