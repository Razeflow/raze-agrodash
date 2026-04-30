-- AgriDash: sanity bounds for numeric fields on agri_records
-- Mirrors lib/validations.ts so any value rejected here is also rejected
-- client-side. Defense in depth — the DB is the last line.
--
-- Apply by pasting into the Supabase SQL Editor (same as prior migrations).
-- If existing rows violate any constraint the corresponding ALTER will fail;
-- inspect the offending row(s) and fix or relax the bound before re-running.

ALTER TABLE public.agri_records
  ADD CONSTRAINT planting_area_sane     CHECK (planting_area_hectares    BETWEEN 0 AND 10000),
  ADD CONSTRAINT harvest_bags_sane      CHECK (harvesting_output_bags    BETWEEN 0 AND 1000000),
  ADD CONSTRAINT pests_damage_sane      CHECK (damage_pests_hectares     BETWEEN 0 AND 10000),
  ADD CONSTRAINT calamity_damage_sane   CHECK (damage_calamity_hectares  BETWEEN 0 AND 10000),
  ADD CONSTRAINT stocking_sane          CHECK (stocking                  BETWEEN 0 AND 1000000),
  ADD CONSTRAINT fishery_harvest_sane   CHECK (harvesting_fishery        BETWEEN 0 AND 1000000),
  ADD CONSTRAINT total_farmers_sane     CHECK (total_farmers             BETWEEN 0 AND 10000),
  ADD CONSTRAINT period_month_valid     CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
  ADD CONSTRAINT period_year_valid      CHECK (period_year  IS NULL OR period_year  BETWEEN 2020 AND 2100);
