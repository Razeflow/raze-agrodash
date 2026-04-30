-- AgriDash: sanity bounds for numeric fields on agri_records
-- Mirrors lib/validations.ts so any value rejected here is also rejected
-- client-side. Defense in depth — the DB is the last line.
--
-- Apply by pasting into the Supabase SQL Editor (same as prior migrations).
-- This script is idempotent (safe to re-run) and uses NOT VALID so it
-- won't fail on legacy rows already outside the bound. New inserts and
-- updates ARE enforced; existing rows are simply skipped at install time.
--
-- Optional follow-up after cleaning legacy data:
--   ALTER TABLE public.agri_records VALIDATE CONSTRAINT planting_area_sane;
--   (repeat for each constraint to retro-enforce on old rows)

-- 1. Drop any partially-applied constraints from a previous attempt
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS planting_area_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS harvest_bags_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS pests_damage_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS calamity_damage_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS stocking_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS fishery_harvest_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS total_farmers_sane;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS period_month_valid;
ALTER TABLE public.agri_records DROP CONSTRAINT IF EXISTS period_year_valid;

-- 2. Re-add with NOT VALID so legacy rows are skipped during install
ALTER TABLE public.agri_records
  ADD CONSTRAINT planting_area_sane     CHECK (planting_area_hectares    BETWEEN 0 AND 10000)   NOT VALID,
  ADD CONSTRAINT harvest_bags_sane      CHECK (harvesting_output_bags    BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT pests_damage_sane      CHECK (damage_pests_hectares     BETWEEN 0 AND 10000)   NOT VALID,
  ADD CONSTRAINT calamity_damage_sane   CHECK (damage_calamity_hectares  BETWEEN 0 AND 10000)   NOT VALID,
  ADD CONSTRAINT stocking_sane          CHECK (stocking                  BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT fishery_harvest_sane   CHECK (harvesting_fishery        BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT total_farmers_sane     CHECK (total_farmers             BETWEEN 0 AND 10000)   NOT VALID,
  ADD CONSTRAINT period_month_valid     CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12)    NOT VALID,
  ADD CONSTRAINT period_year_valid      CHECK (period_year  IS NULL OR period_year  BETWEEN 2020 AND 2100) NOT VALID;
