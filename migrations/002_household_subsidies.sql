-- AgriDash: structured subsidy / RFFA line items per household
-- Run in Supabase SQL Editor after migrations/001_households_orgs.sql (and backup).

CREATE TABLE IF NOT EXISTS public.household_subsidies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'fish_fingerlings', 'fertilizer', 'cash', 'seeds', 'rice_seeds', 'other'
  )),
  product_detail TEXT,
  quantity DOUBLE PRECISION,
  unit TEXT,
  amount_php DOUBLE PRECISION,
  program_source TEXT,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_subsidies_household_id ON public.household_subsidies(household_id);

ALTER TABLE public.household_subsidies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_subsidies_select" ON public.household_subsidies;
CREATE POLICY "household_subsidies_select" ON public.household_subsidies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_subsidies.household_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR h.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "household_subsidies_insert" ON public.household_subsidies;
CREATE POLICY "household_subsidies_insert" ON public.household_subsidies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_subsidies.household_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR h.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "household_subsidies_update" ON public.household_subsidies;
CREATE POLICY "household_subsidies_update" ON public.household_subsidies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_subsidies.household_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR h.barangay = public.get_user_barangay()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_subsidies.household_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR h.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "household_subsidies_delete" ON public.household_subsidies;
CREATE POLICY "household_subsidies_delete" ON public.household_subsidies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_subsidies.household_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR h.barangay = public.get_user_barangay()
      )
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.household_subsidies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
