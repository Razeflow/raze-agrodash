-- AgriDash: lifecycle_status column on agri_records.
-- Tracks per-row planting → damaged → harvested/total_loss progression so
-- aggregations can filter by status instead of guessing from numeric fields.
--
-- Run in Supabase SQL Editor after migrations/008_records_check_constraints.sql.
-- Idempotent: safe to re-run.

-- 1. Add column nullable first so we can backfill before applying NOT NULL.
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

-- 2. Backfill from existing data:
--    Fishery rows:
--      - harvesting_fishery > 0 → harvested
--      - else                  → planted
--    Crop rows:
--      - harvesting_output_bags > 0                                → harvested
--      - planting_area > 0 AND total damage >= planting_area       → total_loss
--      - total damage > 0                                          → damaged
--      - else                                                      → planted
UPDATE public.agri_records
SET lifecycle_status = CASE
  WHEN commodity = 'Fishery' THEN
    CASE
      WHEN COALESCE(harvesting_fishery, 0) > 0 THEN 'harvested'
      ELSE 'planted'
    END
  ELSE
    CASE
      WHEN COALESCE(harvesting_output_bags, 0) > 0 THEN 'harvested'
      WHEN COALESCE(planting_area_hectares, 0) > 0
       AND (COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0))
           >= COALESCE(planting_area_hectares, 0) THEN 'total_loss'
      WHEN (COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0)) > 0 THEN 'damaged'
      ELSE 'planted'
    END
END
WHERE lifecycle_status IS NULL;

-- 3. Lock down the column.
ALTER TABLE public.agri_records
  ALTER COLUMN lifecycle_status SET DEFAULT 'planted';

ALTER TABLE public.agri_records
  ALTER COLUMN lifecycle_status SET NOT NULL;

-- 4. CHECK constraint (idempotent — drop then re-add).
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS lifecycle_status_valid;

ALTER TABLE public.agri_records
  ADD CONSTRAINT lifecycle_status_valid
  CHECK (lifecycle_status IN ('planted', 'damaged', 'harvested', 'total_loss'));

-- 5. Index for status-filtered aggregations (production / damage / active KPIs).
CREATE INDEX IF NOT EXISTS idx_agri_records_lifecycle_status
  ON public.agri_records(lifecycle_status);
