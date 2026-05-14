-- AgriDash: Phase A — turn LAND assets into operational allocation sources.
--
-- Non-destructive, additive. The existing household-level allocation in
-- lib/domain/allocation.ts keeps working untouched; this migration only adds
-- a parallel asset-level allocation path that the application can opt into
-- per record by setting agri_records.farmer_asset_id.
--
-- Idempotent: safe to re-run.
--
-- Required prerequisites:
--   - migrations 001..016 applied
--   - public.farmers, public.farmer_assets, public.agri_records exist
--   - agri_records.status column exists (canonical Phase 2 status; migration 011)
--   - agri_records.commodity_group column exists (migration 011)
--   - agri_records.farmer_ids TEXT[] column exists (original schema)
--
-- After this migration:
--   - agri_records.farmer_asset_id can reference a planting_area farmer_assets row
--   - A BEFORE INSERT/UPDATE trigger enforces:
--       (a) the linked asset is category='planting_area'
--       (b) the asset's owning farmer is listed in agri_records.farmer_ids
--   - farmer_assets gains nullable parcel_label, parcel_code, geom_geojson,
--     centroid_lat, centroid_lng columns. GIS is *not* turned on; these are
--     reserved holders so the app can store GeoJSON now and migrate to
--     PostGIS later without further schema churn.
--   - View v_land_asset_allocation exposes per-asset total / utilized /
--     remaining hectares (active CROP records only).
--   - Function fn_remaining_land_ha(asset_id, exclude_record_id) supports
--     form-time live validation, with the exclusion arg so editing an
--     active record does not double-count its own allocation.

-- =========================================================================
-- 1) agri_records.farmer_asset_id
-- =========================================================================

ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS farmer_asset_id UUID NULL
    REFERENCES public.farmer_assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agri_records.farmer_asset_id IS
  'Optional FK to farmer_assets(id). When set, this record allocates against '
  'the specific LAND (planting_area) asset rather than the household-level '
  'farming_area_hectares pool. Enforced by trg_validate_record_asset.';

-- Index supports the active-allocation aggregate in v_land_asset_allocation
-- and fn_remaining_land_ha. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_agri_records_farmer_asset_id_active
  ON public.agri_records (farmer_asset_id, status)
  WHERE farmer_asset_id IS NOT NULL;

-- =========================================================================
-- 2) Trigger: validate farmer_asset_id linkage
-- =========================================================================
--
-- Runs with SECURITY INVOKER (default) so the caller's RLS view of
-- farmer_assets is what gets enforced. A user who cannot SELECT the asset
-- cannot link to it. NULL farmer_asset_id is allowed (legacy / unmigrated
-- records keep working).

CREATE OR REPLACE FUNCTION public.fn_validate_record_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_category TEXT;
  v_owner    UUID;
BEGIN
  IF NEW.farmer_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT category, farmer_id
    INTO v_category, v_owner
    FROM public.farmer_assets
    WHERE id = NEW.farmer_asset_id;

  IF v_category IS NULL THEN
    RAISE EXCEPTION
      'farmer_asset_id % is not accessible or does not exist',
      NEW.farmer_asset_id;
  END IF;

  IF v_category <> 'planting_area' THEN
    RAISE EXCEPTION
      'farmer_asset_id % has category=%, only planting_area assets are valid '
      'allocation sources',
      NEW.farmer_asset_id, v_category;
  END IF;

  -- Owning farmer must be among the record's listed farmer_ids. agri_records
  -- stores farmer_ids as TEXT[]; compare on text to avoid implicit casts.
  IF NEW.farmer_ids IS NULL
     OR NOT (v_owner::text = ANY(NEW.farmer_ids))
  THEN
    RAISE EXCEPTION
      'land owner % (farmer_assets.farmer_id) must be included in agri_records.farmer_ids',
      v_owner;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validate_record_asset ON public.agri_records;
CREATE TRIGGER trg_validate_record_asset
  BEFORE INSERT OR UPDATE OF farmer_asset_id, farmer_ids ON public.agri_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_record_asset();

-- =========================================================================
-- 3) farmer_assets: backfill area_hectares + add GIS-ready columns
-- =========================================================================
--
-- area_hectares is defined by migration 007 but some environments were
-- bootstrapped via scripts/schema.sql, which does not include farmer_assets
-- at all. Where the table exists without this column, the view and RPC
-- below would fail to compile. Add it idempotently as a self-heal.

ALTER TABLE public.farmer_assets
  ADD COLUMN IF NOT EXISTS area_hectares DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS parcel_label  TEXT,
  ADD COLUMN IF NOT EXISTS parcel_code   TEXT,
  ADD COLUMN IF NOT EXISTS geom_geojson  JSONB,
  ADD COLUMN IF NOT EXISTS centroid_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS centroid_lng  DOUBLE PRECISION;

COMMENT ON COLUMN public.farmer_assets.parcel_label IS
  'Human-readable label for a LAND parcel, e.g. "Farm Lot A".';
COMMENT ON COLUMN public.farmer_assets.parcel_code IS
  'Optional external identifier (cadastral / RSBSA / etc.) for the parcel.';
COMMENT ON COLUMN public.farmer_assets.geom_geojson IS
  'Parcel geometry stored as GeoJSON. Reserved for later PostGIS migration; '
  'no spatial indexing here.';
COMMENT ON COLUMN public.farmer_assets.centroid_lat IS
  'Denormalised centroid latitude (WGS84). Cheap to render on a map without '
  'parsing geom_geojson.';
COMMENT ON COLUMN public.farmer_assets.centroid_lng IS
  'Denormalised centroid longitude (WGS84).';

-- =========================================================================
-- 4) View: per-asset allocation snapshot
-- =========================================================================
--
-- security_invoker=true (PG 15+) so RLS on farmer_assets and agri_records
-- applies to view reads. Without it, the view would run as its owner and
-- bypass RLS.
--
-- Only ACTIVE records consume area. status flipping to harvested / damaged /
-- archived releases the allocation by virtue of being filtered out here.

DROP VIEW IF EXISTS public.v_land_asset_allocation;
CREATE VIEW public.v_land_asset_allocation
WITH (security_invoker = true) AS
SELECT
  fa.id            AS asset_id,
  fa.farmer_id,
  fa.parcel_label,
  fa.area_hectares AS total_ha,
  COALESCE(
    SUM(ar.planting_area_hectares) FILTER (WHERE ar.status = 'active'),
    0
  ) AS utilized_ha,
  COALESCE(fa.area_hectares, 0) - COALESCE(
    SUM(ar.planting_area_hectares) FILTER (WHERE ar.status = 'active'),
    0
  ) AS remaining_ha,
  COUNT(*) FILTER (WHERE ar.status = 'active') AS active_record_count
FROM public.farmer_assets fa
LEFT JOIN public.agri_records ar
  ON ar.farmer_asset_id = fa.id
WHERE fa.category = 'planting_area'
GROUP BY fa.id, fa.farmer_id, fa.parcel_label, fa.area_hectares;

COMMENT ON VIEW public.v_land_asset_allocation IS
  'Per-LAND-asset allocation snapshot. utilized_ha is the sum of active '
  'agri_records.planting_area_hectares pointing at the asset; remaining_ha '
  'is total_ha minus utilized_ha. Inherits RLS via security_invoker.';

-- =========================================================================
-- 5) RPC: fn_remaining_land_ha
-- =========================================================================
--
-- Drives the live "Remaining: X ha on Farm Lot A" hint in RecordFormDialog.
-- When editing an existing active record, pass that record's id as
-- p_exclude_record_id so its own contribution is not double-counted.

CREATE OR REPLACE FUNCTION public.fn_remaining_land_ha(
  p_asset_id          UUID,
  p_exclude_record_id UUID DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(fa.area_hectares, 0)
    - COALESCE((
        SELECT SUM(ar.planting_area_hectares)
        FROM public.agri_records ar
        WHERE ar.farmer_asset_id = fa.id
          AND ar.status = 'active'
          AND (p_exclude_record_id IS NULL OR ar.id <> p_exclude_record_id)
      ), 0)
  FROM public.farmer_assets fa
  WHERE fa.id = p_asset_id
    AND fa.category = 'planting_area';
$$;

COMMENT ON FUNCTION public.fn_remaining_land_ha(UUID, UUID) IS
  'Returns remaining (unallocated) hectares on a LAND (planting_area) asset. '
  'Pass p_exclude_record_id when editing an existing active record so its '
  'own allocation is not subtracted from itself. Returns NULL if the asset '
  'is not visible to the caller or is not a planting_area asset.';

-- =========================================================================
-- Verification queries (run manually after applying):
-- =========================================================================
--
--   -- 1. Column + FK are in place
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='agri_records'
--     AND column_name='farmer_asset_id';
--   -- expect 1 row: uuid, YES
--
--   -- 2. Trigger exists
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.agri_records'::regclass
--     AND tgname = 'trg_validate_record_asset';
--   -- expect 1 row
--
--   -- 3. View returns rows (empty allocation if no planting_area assets yet)
--   SELECT * FROM public.v_land_asset_allocation LIMIT 5;
--
--   -- 4. RPC smoke test (replace UUID with a real planting_area asset id)
--   SELECT public.fn_remaining_land_ha('00000000-0000-0000-0000-000000000000');
--   -- expect NULL for a non-existent / non-planting_area asset
--
--   -- 5. Negative test (should RAISE):
--   --    INSERT INTO public.agri_records (..., farmer_asset_id) VALUES
--   --      (..., '<a-machinery-asset-id>');
--   --    -- expect: "only planting_area assets are valid allocation sources"
