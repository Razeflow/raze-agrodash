-- Phase 1: Domain model stabilization (non-destructive).
-- Adds commodity_group + record status + commodity-specific fields.
-- Idempotent: safe to re-run.

-- 1) Commodity group (denormalized for filtering and RLS-friendly queries)
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS commodity_group TEXT;

UPDATE public.agri_records
SET commodity_group = CASE
  WHEN commodity = 'Fishery' THEN 'FISHERY'
  WHEN commodity = 'Livestock' THEN 'LIVESTOCK'
  ELSE 'CROP'
END
WHERE commodity_group IS NULL;

ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS commodity_group_valid;

ALTER TABLE public.agri_records
  ADD CONSTRAINT commodity_group_valid
  CHECK (commodity_group IN ('CROP', 'FISHERY', 'LIVESTOCK')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_agri_records_commodity_group
  ON public.agri_records(commodity_group);

-- 2) Phase 1 record status (active/harvested/damaged/archived)
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.agri_records
SET status = CASE
  WHEN lifecycle_status = 'harvested' THEN 'harvested'
  WHEN lifecycle_status = 'total_loss' THEN 'damaged'
  ELSE 'active'
END
WHERE status IS NULL;

ALTER TABLE public.agri_records
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS status_valid;

ALTER TABLE public.agri_records
  ADD CONSTRAINT status_valid
  CHECK (status IN ('active', 'harvested', 'damaged', 'archived')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_agri_records_status
  ON public.agri_records(status);

-- 3) Commodity-specific fields (additive)
-- Fishery loss pieces (fishery is pieces-only going forward)
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS fishery_loss_pieces NUMERIC;

-- Livestock (heads)
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS livestock_stocking_heads NUMERIC,
  ADD COLUMN IF NOT EXISTS livestock_output_heads NUMERIC,
  ADD COLUMN IF NOT EXISTS livestock_dead_heads NUMERIC;

-- 4) Sanity constraints for new fields (non-negative, generous max)
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS fishery_loss_sane,
  DROP CONSTRAINT IF EXISTS livestock_stocking_sane,
  DROP CONSTRAINT IF EXISTS livestock_output_sane,
  DROP CONSTRAINT IF EXISTS livestock_dead_sane;

ALTER TABLE public.agri_records
  ADD CONSTRAINT fishery_loss_sane        CHECK (fishery_loss_pieces       IS NULL OR fishery_loss_pieces       BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT livestock_stocking_sane  CHECK (livestock_stocking_heads  IS NULL OR livestock_stocking_heads  BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT livestock_output_sane    CHECK (livestock_output_heads    IS NULL OR livestock_output_heads    BETWEEN 0 AND 1000000) NOT VALID,
  ADD CONSTRAINT livestock_dead_sane      CHECK (livestock_dead_heads      IS NULL OR livestock_dead_heads      BETWEEN 0 AND 1000000) NOT VALID;

-- 5) Domain constraints (Phase 1)
-- Fishery should not use hectares/bags; Livestock should not use hectares/bags.
-- Marked NOT VALID so legacy rows won't block installation.
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS fishery_units_valid,
  DROP CONSTRAINT IF EXISTS livestock_units_valid;

ALTER TABLE public.agri_records
  ADD CONSTRAINT fishery_units_valid CHECK (
    commodity <> 'Fishery'
    OR (
      COALESCE(planting_area_hectares, 0) = 0
      AND COALESCE(harvesting_output_bags, 0) = 0
      AND COALESCE(damage_pests_hectares, 0) = 0
      AND COALESCE(damage_calamity_hectares, 0) = 0
    )
  ) NOT VALID,
  ADD CONSTRAINT livestock_units_valid CHECK (
    commodity <> 'Livestock'
    OR (
      COALESCE(planting_area_hectares, 0) = 0
      AND COALESCE(harvesting_output_bags, 0) = 0
      AND COALESCE(damage_pests_hectares, 0) = 0
      AND COALESCE(damage_calamity_hectares, 0) = 0
      AND COALESCE(stocking, 0) = 0
      AND COALESCE(harvesting_fishery, 0) = 0
    )
  ) NOT VALID;

