-- AgriDash: households, organizations, farmer profiles extension
-- Run in Supabase SQL Editor after backup.
-- See migrations/STORAGE.md for farmer-photos bucket.

-- 1) Organizations (create before households)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('cooperative', 'association', 'household_group', 'other')),
  barangay TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_barangay ON public.organizations(barangay);

-- 2) Households
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  farming_area_hectares DOUBLE PRECISION DEFAULT 0,
  rffa_subsidies_notes TEXT DEFAULT '',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_households_barangay ON public.households(barangay);

-- 3) Farmer columns
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rsbsa_number TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS civil_status TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_farmers_household_id ON public.farmers(household_id);

-- 4) Farmer–organization links
CREATE TABLE IF NOT EXISTS public.farmer_organizations (
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (farmer_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_organizations_org ON public.farmer_organizations(organization_id);

-- 5) RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay IS NULL
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "households_select" ON public.households;
CREATE POLICY "households_select" ON public.households
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "households_insert" ON public.households;
CREATE POLICY "households_insert" ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "households_update" ON public.households;
CREATE POLICY "households_update" ON public.households
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "households_delete" ON public.households;
CREATE POLICY "households_delete" ON public.households
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "fo_select" ON public.farmer_organizations;
CREATE POLICY "fo_select" ON public.farmer_organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_organizations.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "fo_insert" ON public.farmer_organizations;
CREATE POLICY "fo_insert" ON public.farmer_organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_organizations.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

DROP POLICY IF EXISTS "fo_delete" ON public.farmer_organizations;
CREATE POLICY "fo_delete" ON public.farmer_organizations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_organizations.farmer_id
      AND (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR f.barangay = public.get_user_barangay()
      )
    )
  );

-- 6) Backfill: one household per farmer currently without household_id
DO $$
DECLARE r RECORD;
DECLARE hid UUID;
BEGIN
  FOR r IN SELECT id, barangay, name FROM public.farmers WHERE household_id IS NULL LOOP
    hid := gen_random_uuid();
    INSERT INTO public.households (id, barangay, display_name, farming_area_hectares, rffa_subsidies_notes)
    VALUES (hid, r.barangay, 'Household — ' || r.name, 0, '');
    UPDATE public.farmers SET household_id = hid WHERE id = r.id;
  END LOOP;
END $$;

-- 7) Realtime (ignore errors if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_organizations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
