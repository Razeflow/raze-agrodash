-- AgriDash: reset farmer_assets to the canonical schema expected by the app
-- and by migrations 007, 009, 017.
--
-- WHY THIS MIGRATION EXISTS
-- ------------------------
-- The live database was bootstrapped via scripts/schema.sql, which does not
-- include farmer_assets. An out-of-band CREATE TABLE produced a farmer_assets
-- with diverged column names (asset_type, name, size_or_quantity, location)
-- that does not match migrations 007 / 009 or the app code in
-- lib/contexts/farmers-context.tsx and components/dashboard/FarmerAssetsDialog.tsx.
-- This migration discards the diverged table (verified 0 rows before writing)
-- and recreates it in the canonical shape, including:
--   - migration 007 columns (id, farmer_id, category, sub_category,
--     product_detail, quantity, unit, area_hectares, acquired_date, notes,
--     created_at, updated_at)
--   - migration 009's expanded category CHECK (adds 'livestock')
--   - migration 017 §3 GIS-ready columns (parcel_label, parcel_code,
--     geom_geojson, centroid_lat, centroid_lng)
--   - migration 007 RLS policies (per-barangay via the owning farmer)
--   - supabase_realtime publication membership
--
-- SAFETY
-- ------
-- DROP TABLE ... CASCADE will also drop any FK from agri_records.farmer_asset_id
-- that an earlier (partial) run of migration 017 may have created. After 018
-- runs, re-run migration 017 to recreate that column, the trigger, the view,
-- and the RPC against the correct base table.
--
-- This migration is idempotent: re-running it produces the same canonical
-- table, but will *erase* farmer_assets data each time. Treat it as a
-- one-time reset, not a routine migration.

-- =========================================================================
-- 1) Drop the diverged table (cascades to any dependents from prior 017 runs)
-- =========================================================================

DROP TABLE IF EXISTS public.farmer_assets CASCADE;

-- =========================================================================
-- 2) Recreate farmer_assets in the canonical shape
-- =========================================================================

CREATE TABLE public.farmer_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id       UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  sub_category    TEXT,
  product_detail  TEXT,
  quantity        DOUBLE PRECISION,
  unit            TEXT,
  area_hectares   DOUBLE PRECISION,
  acquired_date   DATE,
  notes           TEXT,
  -- GIS-ready columns (from migration 017 §3; populated later)
  parcel_label    TEXT,
  parcel_code     TEXT,
  geom_geojson    JSONB,
  centroid_lat    DOUBLE PRECISION,
  centroid_lng    DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT farmer_assets_category_check CHECK (category IN (
    'planting_area', 'machinery', 'fishpond', 'facility', 'livestock'
  ))
);

CREATE INDEX idx_farmer_assets_farmer_id ON public.farmer_assets(farmer_id);

-- =========================================================================
-- 3) RLS — mirror migration 007 (per-barangay via owning farmer)
-- =========================================================================

ALTER TABLE public.farmer_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farmer_assets_select" ON public.farmer_assets;
CREATE POLICY "farmer_assets_select" ON public.farmer_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_assets.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "farmer_assets_insert" ON public.farmer_assets;
CREATE POLICY "farmer_assets_insert" ON public.farmer_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_assets.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "farmer_assets_update" ON public.farmer_assets;
CREATE POLICY "farmer_assets_update" ON public.farmer_assets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_assets.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_assets.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "farmer_assets_delete" ON public.farmer_assets;
CREATE POLICY "farmer_assets_delete" ON public.farmer_assets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_assets.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

-- =========================================================================
-- 4) Realtime publication
-- =========================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_assets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- Verification (run manually after applying):
-- =========================================================================
--
--   -- 1. Columns match the canonical schema
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='farmer_assets'
--   ORDER BY ordinal_position;
--   -- expect 17 rows: id, farmer_id, category, sub_category, product_detail,
--   --                 quantity, unit, area_hectares, acquired_date, notes,
--   --                 parcel_label, parcel_code, geom_geojson, centroid_lat,
--   --                 centroid_lng, created_at, updated_at
--
--   -- 2. RLS is on with 4 policies
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='farmer_assets'
--   ORDER BY policyname;
--   -- expect 4 rows
--
-- NEXT STEP: re-run migrations/017_land_allocation.sql to recreate the
-- agri_records.farmer_asset_id column, the validation trigger, the
-- v_land_asset_allocation view, and the fn_remaining_land_ha RPC.
