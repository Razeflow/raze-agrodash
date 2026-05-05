-- AgriDash: per-farmer asset inventory (planting area, machinery, fishpond, facility)
-- Run in Supabase SQL Editor after migrations/001_households_orgs.sql.

CREATE TABLE IF NOT EXISTS public.farmer_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'planting_area', 'machinery', 'fishpond', 'facility'
  )),
  sub_category TEXT,
  product_detail TEXT,
  quantity DOUBLE PRECISION,
  unit TEXT,
  area_hectares DOUBLE PRECISION,
  acquired_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farmer_assets_farmer_id ON public.farmer_assets(farmer_id);

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

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_assets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
