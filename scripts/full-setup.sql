-- AgriDash: Complete database setup (schema + all migrations + grants)
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.

-- =====================================================================
-- 1) TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'BARANGAY_USER')),
  barangay TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('cooperative', 'association', 'household_group', 'other')),
  barangay TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_barangay ON public.organizations(barangay);

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

CREATE TABLE IF NOT EXISTS public.farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  barangay TEXT NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  rsbsa_number TEXT,
  birth_date DATE,
  civil_status TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farmers_barangay ON public.farmers(barangay);
CREATE INDEX IF NOT EXISTS idx_farmers_household_id ON public.farmers(household_id);

-- Migration 005: household head flag
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS is_household_head BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.farmer_organizations (
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (farmer_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_organizations_org ON public.farmer_organizations(organization_id);

CREATE TABLE IF NOT EXISTS public.agri_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay TEXT NOT NULL,
  commodity TEXT NOT NULL,
  sub_category TEXT NOT NULL DEFAULT '',
  farmer_ids TEXT[] DEFAULT '{}',
  farmer_names TEXT DEFAULT '',
  farmer_male INT DEFAULT 0,
  farmer_female INT DEFAULT 0,
  total_farmers INT DEFAULT 0,
  planting_area_hectares DOUBLE PRECISION DEFAULT 0,
  harvesting_output_bags DOUBLE PRECISION DEFAULT 0,
  damage_pests_hectares DOUBLE PRECISION DEFAULT 0,
  damage_calamity_hectares DOUBLE PRECISION DEFAULT 0,
  stocking DOUBLE PRECISION DEFAULT 0,
  harvesting_fishery DOUBLE PRECISION DEFAULT 0,
  pests_diseases TEXT DEFAULT 'None',
  calamity TEXT DEFAULT 'None',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migration 003: calamity sub-category
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS calamity_sub_category TEXT NOT NULL DEFAULT 'None';

-- Migration 007: reporting period (form already collects month/year; columns persist them)
ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS period_month SMALLINT,
  ADD COLUMN IF NOT EXISTS period_year  SMALLINT;

-- Backfill any rows missing a period from created_at (Asia/Manila).
UPDATE public.agri_records
SET
  period_month = EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Asia/Manila'))::smallint,
  period_year  = EXTRACT(YEAR  FROM (created_at AT TIME ZONE 'Asia/Manila'))::smallint
WHERE period_month IS NULL OR period_year IS NULL;

CREATE INDEX IF NOT EXISTS idx_agri_records_barangay ON public.agri_records(barangay);
CREATE INDEX IF NOT EXISTS idx_agri_records_period ON public.agri_records(period_year, period_month);

-- =====================================================================
-- 2) ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_subsidies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 3) HELPER FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_barangay()
RETURNS TEXT AS $$
  SELECT barangay FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================
-- 4) RLS POLICIES
-- =====================================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- organizations (migration 004: admin-only insert/update/delete)
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
  WITH CHECK (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- households
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

-- household_subsidies
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

-- farmers
DROP POLICY IF EXISTS "farmers_select" ON public.farmers;
CREATE POLICY "farmers_select" ON public.farmers
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "farmers_insert" ON public.farmers;
CREATE POLICY "farmers_insert" ON public.farmers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "farmers_update" ON public.farmers;
CREATE POLICY "farmers_update" ON public.farmers
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "farmers_delete" ON public.farmers;
CREATE POLICY "farmers_delete" ON public.farmers
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- farmer_organizations
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

-- agri_records
DROP POLICY IF EXISTS "records_select" ON public.agri_records;
CREATE POLICY "records_select" ON public.agri_records
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "records_insert" ON public.agri_records;
CREATE POLICY "records_insert" ON public.agri_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "records_update" ON public.agri_records;
CREATE POLICY "records_update" ON public.agri_records
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

DROP POLICY IF EXISTS "records_delete" ON public.agri_records;
CREATE POLICY "records_delete" ON public.agri_records
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- =====================================================================
-- 5) REALTIME (wrapped so duplicates don't crash the script)
-- =====================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agri_records;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.farmers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.household_subsidies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 6) AUTO-PROFILE TRIGGER (migration 006)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'BARANGAY_USER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create SUPER_ADMIN profile for any existing auth users missing one
INSERT INTO public.profiles (id, username, display_name, role, barangay)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'SUPER_ADMIN',
  NULL
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 7) GRANTS (fixes PGRST205 — PostgREST needs these to see the tables)
-- =====================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- =====================================================================
-- 8) RELOAD PostgREST schema cache
-- =====================================================================

NOTIFY pgrst, 'reload schema';
