-- Validate Phase 2 constraints after legacy rows are cleaned.
-- Run the diagnostics first; then validate.

-- Diagnostics:
-- 1) Crop rows where damage > planting area
-- SELECT count(*) FROM public.agri_records
-- WHERE commodity_group = 'CROP'
--   AND (COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0))
--       > COALESCE(planting_area_hectares, 0) + 0.000001;
--
-- 2) harvested status with missing output
-- SELECT count(*) FROM public.agri_records
-- WHERE status = 'harvested'
--   AND NOT (
--     (commodity_group = 'CROP' AND COALESCE(harvesting_output_bags, 0) > 0)
--     OR (commodity_group = 'FISHERY' AND COALESCE(harvesting_fishery, 0) > 0)
--     OR (commodity_group = 'LIVESTOCK' AND COALESCE(livestock_output_heads, 0) > 0)
--   );
--
-- 3) damaged status with missing loss or non-zero output
-- SELECT count(*) FROM public.agri_records
-- WHERE status = 'damaged'
--   AND NOT (
--     (commodity_group = 'CROP' AND (COALESCE(damage_pests_hectares, 0) + COALESCE(damage_calamity_hectares, 0)) > 0 AND COALESCE(harvesting_output_bags, 0) = 0)
--     OR (commodity_group = 'FISHERY' AND COALESCE(fishery_loss_pieces, 0) > 0 AND COALESCE(harvesting_fishery, 0) = 0)
--     OR (commodity_group = 'LIVESTOCK' AND COALESCE(livestock_dead_heads, 0) > 0 AND COALESCE(livestock_output_heads, 0) = 0)
--   );

ALTER TABLE public.agri_records VALIDATE CONSTRAINT crop_damage_leq_area;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT status_harvest_requires_output;
ALTER TABLE public.agri_records VALIDATE CONSTRAINT status_damage_requires_loss;

