-- Phase 2: Validation + domain enforcement + aggregation integrity
-- Non-destructive, uses NOT VALID constraints first.
-- Idempotent: safe to re-run.

-- 1) Enforce crop damage cannot exceed planting area (crop rows only).
-- Gate by commodity_group so the rule only applies to CROP rows. The earlier
-- form of this constraint mixed AND/OR without parens and was always TRUE for
-- crop rows due to operator precedence — that bug is fixed here.
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS crop_damage_leq_area;

ALTER TABLE public.agri_records
  ADD CONSTRAINT crop_damage_leq_area CHECK (
    commodity_group <> 'CROP'
    OR (
      COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0)
      <= COALESCE(planting_area_hectares, 0) + 0.000001
    )
  ) NOT VALID;

-- 2) Phase 2 status evidence rules (status column introduced in migration 011).
-- harvested => must have output in the correct unit (bags for crops, pieces for fishery, heads for livestock).
-- damaged   => must have loss evidence and no finalized output.
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS status_harvest_requires_output,
  DROP CONSTRAINT IF EXISTS status_damage_requires_loss;

ALTER TABLE public.agri_records
  ADD CONSTRAINT status_harvest_requires_output CHECK (
    status <> 'harvested'
    OR (
      (commodity_group = 'CROP' AND COALESCE(harvesting_output_bags, 0) > 0)
      OR (commodity_group = 'FISHERY' AND COALESCE(harvesting_fishery, 0) > 0)
      OR (commodity_group = 'LIVESTOCK' AND COALESCE(livestock_output_heads, 0) > 0)
    )
  ) NOT VALID,
  ADD CONSTRAINT status_damage_requires_loss CHECK (
    status <> 'damaged'
    OR (
      (commodity_group = 'CROP' AND (COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0)) > 0 AND COALESCE(harvesting_output_bags, 0) = 0)
      OR (commodity_group = 'FISHERY' AND COALESCE(fishery_loss_pieces, 0) > 0 AND COALESCE(harvesting_fishery, 0) = 0)
      OR (commodity_group = 'LIVESTOCK' AND COALESCE(livestock_dead_heads, 0) > 0 AND COALESCE(livestock_output_heads, 0) = 0)
    )
  ) NOT VALID;

-- 3) Archived rows: terminal status is enforced by a trigger in migration 015.
-- The previous CHECK constraint here was a tautology and is dropped if present.
ALTER TABLE public.agri_records
  DROP CONSTRAINT IF EXISTS archived_status_is_terminal;

