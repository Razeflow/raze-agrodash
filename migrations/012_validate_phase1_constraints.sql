-- AgriDash: validate the NOT VALID constraints added by migration 011.
--
-- Migration 011 introduced commodity_group, status, fishery loss / livestock
-- head columns and their CHECK constraints as NOT VALID, so installation never
-- blocks on legacy rows. This migration flips those constraints to VALIDATED
-- so future writes are enforced server-side.
--
-- Run AFTER migrations/011_phase1_domain_model.sql AND after the diagnostic
-- queries below all return 0. If any VALIDATE statement fails, fix the rows
-- it points at and re-run — VALIDATE is idempotent for already-valid
-- constraints, so re-running is safe.
--
-- Diagnostic queries (run manually in the SQL editor first):
--
--   -- 1. Rows missing the denormalized values (should be 0):
--   SELECT count(*) FROM public.agri_records
--   WHERE commodity_group IS NULL OR status IS NULL;
--
--   -- 2. Fishery rows with crop fields populated (should be 0):
--   SELECT count(*) FROM public.agri_records
--   WHERE commodity = 'Fishery'
--     AND (
--       COALESCE(planting_area_hectares, 0) > 0
--       OR COALESCE(harvesting_output_bags, 0) > 0
--       OR COALESCE(damage_pests_hectares, 0) > 0
--       OR COALESCE(damage_calamity_hectares, 0) > 0
--     );
--
--   -- 3. Livestock rows with crop or fishery fields populated (should be 0):
--   SELECT count(*) FROM public.agri_records
--   WHERE commodity = 'Livestock'
--     AND (
--       COALESCE(planting_area_hectares, 0) > 0
--       OR COALESCE(harvesting_output_bags, 0) > 0
--       OR COALESCE(damage_pests_hectares, 0) > 0
--       OR COALESCE(damage_calamity_hectares, 0) > 0
--       OR COALESCE(stocking, 0) > 0
--       OR COALESCE(harvesting_fishery, 0) > 0
--     );
--
--   -- 4. Out-of-range numeric fields (should be 0):
--   SELECT count(*) FROM public.agri_records
--   WHERE (fishery_loss_pieces       IS NOT NULL AND fishery_loss_pieces       NOT BETWEEN 0 AND 1000000)
--      OR (livestock_stocking_heads  IS NOT NULL AND livestock_stocking_heads  NOT BETWEEN 0 AND 1000000)
--      OR (livestock_output_heads    IS NOT NULL AND livestock_output_heads    NOT BETWEEN 0 AND 1000000)
--      OR (livestock_dead_heads      IS NOT NULL AND livestock_dead_heads      NOT BETWEEN 0 AND 1000000);

-- 1) Enum-style CHECK constraints
ALTER TABLE public.agri_records VALIDATE CONSTRAINT commodity_group_valid;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT status_valid;

-- 2) Sanity bounds (0 .. 1,000,000) for new commodity-specific fields
ALTER TABLE public.agri_records VALIDATE CONSTRAINT fishery_loss_sane;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT livestock_stocking_sane;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT livestock_output_sane;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT livestock_dead_sane;

-- 3) Domain unit isolation (fishery uses pieces only, livestock uses heads only)
ALTER TABLE public.agri_records VALIDATE CONSTRAINT fishery_units_valid;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT livestock_units_valid;
