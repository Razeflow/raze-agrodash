-- Profiles table
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'BARANGAY_USER')),
      barangay TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Farmers table
    CREATE TABLE IF NOT EXISTS public.farmers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
      barangay TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Agri records table
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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_agri_records_barangay ON public.agri_records(barangay);
    CREATE INDEX IF NOT EXISTS idx_farmers_barangay ON public.farmers(barangay);

    -- Enable RLS
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.agri_records ENABLE ROW LEVEL SECURITY;

    -- Helper: get current user role
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS TEXT AS $$
      SELECT role FROM public.profiles WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE;

    -- Helper: get current user barangay
    CREATE OR REPLACE FUNCTION public.get_user_barangay()
    RETURNS TEXT AS $$
      SELECT barangay FROM public.profiles WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE;

    -- Profiles: all auth users can read all profiles
    DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
    CREATE POLICY "profiles_select" ON public.profiles
      FOR SELECT TO authenticated USING (true);

    -- Profiles: users can update own
    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE TO authenticated USING (id = auth.uid());

    -- Farmers: select
    DROP POLICY IF EXISTS "farmers_select" ON public.farmers;
    CREATE POLICY "farmers_select" ON public.farmers
      FOR SELECT TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Farmers: insert
    DROP POLICY IF EXISTS "farmers_insert" ON public.farmers;
    CREATE POLICY "farmers_insert" ON public.farmers
      FOR INSERT TO authenticated
      WITH CHECK (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Farmers: update
    DROP POLICY IF EXISTS "farmers_update" ON public.farmers;
    CREATE POLICY "farmers_update" ON public.farmers
      FOR UPDATE TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Farmers: delete
    DROP POLICY IF EXISTS "farmers_delete" ON public.farmers;
    CREATE POLICY "farmers_delete" ON public.farmers
      FOR DELETE TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Records: select
    DROP POLICY IF EXISTS "records_select" ON public.agri_records;
    CREATE POLICY "records_select" ON public.agri_records
      FOR SELECT TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Records: insert
    DROP POLICY IF EXISTS "records_insert" ON public.agri_records;
    CREATE POLICY "records_insert" ON public.agri_records
      FOR INSERT TO authenticated
      WITH CHECK (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Records: update
    DROP POLICY IF EXISTS "records_update" ON public.agri_records;
    CREATE POLICY "records_update" ON public.agri_records
      FOR UPDATE TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Records: delete
    DROP POLICY IF EXISTS "records_delete" ON public.agri_records;
    CREATE POLICY "records_delete" ON public.agri_records
      FOR DELETE TO authenticated
      USING (
        public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
        OR barangay = public.get_user_barangay()
      );

    -- Enable realtime for both data tables
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agri_records;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmers;