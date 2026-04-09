// One-time script: Sets up Supabase schema + seeds 13 users
// Run: node scripts/setup-supabase.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL env var");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  // Use the SQL endpoint directly
  return res;
}

async function execSQL(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: sql,
  });
  console.log(`  ${label}: ${res.ok ? "OK" : res.status}`);
}

// Use the pg_net or direct SQL approach via Supabase Management API
async function executeSQLViaManagement(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

// ── Step 1: Create tables via SQL Editor proxy ──
async function setupSchema() {
  console.log("\n📦 Step 1: Creating database schema...\n");

  const schema = `
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
  `;

  // Run SQL via Supabase's pg endpoint
  const res = await fetch(`${SUPABASE_URL}/pg`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: schema }),
  });

  if (res.ok) {
    console.log("  ✅ Schema created successfully!\n");
  } else {
    // If /pg doesn't work, output the SQL for manual execution
    console.log("  ⚠️  Could not run SQL via API. Please run it manually in the SQL Editor.\n");
    console.log("  Saving SQL to scripts/schema.sql ...\n");
    require("fs").writeFileSync("scripts/schema.sql", schema.trim());
    console.log("  ✅ Saved to scripts/schema.sql — paste this in Supabase Dashboard → SQL Editor → Run\n");
  }
}

// ── Step 2: Seed 13 users ──
async function seedUsers() {
  console.log("👥 Step 2: Seeding 13 user accounts...\n");

  const ACCOUNTS = [
    { username: "superadmin", password: "admin123", role: "SUPER_ADMIN", barangay: null, displayName: "Super Admin" },
    { username: "admin1", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 1" },
    { username: "admin2", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 2" },
    { username: "supo", password: "user123", role: "BARANGAY_USER", barangay: "Supo", displayName: "Supo Officer" },
    { username: "poblacion", password: "user123", role: "BARANGAY_USER", barangay: "Poblacion", displayName: "Poblacion Officer" },
    { username: "wayangan", password: "user123", role: "BARANGAY_USER", barangay: "Wayangan", displayName: "Wayangan Officer" },
    { username: "kili", password: "user123", role: "BARANGAY_USER", barangay: "Kili", displayName: "Kili Officer" },
    { username: "tiempo", password: "user123", role: "BARANGAY_USER", barangay: "Tiempo", displayName: "Tiempo Officer" },
    { username: "amtuagan", password: "user123", role: "BARANGAY_USER", barangay: "Amtuagan", displayName: "Amtuagan Officer" },
    { username: "tabacda", password: "user123", role: "BARANGAY_USER", barangay: "Tabacda", displayName: "Tabacda Officer" },
    { username: "alangtin", password: "user123", role: "BARANGAY_USER", barangay: "Alangtin", displayName: "Alangtin Officer" },
    { username: "dilong", password: "user123", role: "BARANGAY_USER", barangay: "Dilong", displayName: "Dilong Officer" },
    { username: "tubtuba", password: "user123", role: "BARANGAY_USER", barangay: "Tubtuba", displayName: "Tubtuba Officer" },
  ];

  let created = 0;
  let skipped = 0;

  for (const acct of ACCOUNTS) {
    const email = `${acct.username}@agridash.local`;

    // Create auth user
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: acct.password,
        email_confirm: true,
        user_metadata: { username: acct.username, display_name: acct.displayName },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      if (authData.msg && authData.msg.includes("already been registered")) {
        console.log(`  ⏭️  ${acct.username} — already exists, skipping`);
        skipped++;
        continue;
      }
      console.error(`  ❌ ${acct.username} — auth error: ${authData.msg || authData.message || JSON.stringify(authData)}`);
      continue;
    }

    const userId = authData.id;

    // Create profile row
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        id: userId,
        username: acct.username,
        display_name: acct.displayName,
        role: acct.role,
        barangay: acct.barangay,
      }),
    });

    if (profileRes.ok) {
      console.log(`  ✅ ${acct.username} (${acct.role}${acct.barangay ? ` → ${acct.barangay}` : ""})`);
      created++;
    } else {
      const err = await profileRes.text();
      console.error(`  ❌ ${acct.username} — profile error: ${err}`);
    }
  }

  console.log(`\n  Done: ${created} created, ${skipped} skipped\n`);
}

// ── Main ──
async function main() {
  console.log("🌾 Raze AgroDash — Supabase Setup\n");
  console.log(`  URL: ${SUPABASE_URL}`);
  console.log(`  Key: ${SERVICE_ROLE_KEY.substring(0, 20)}...`);

  await setupSchema();
  await seedUsers();

  console.log("🎉 Setup complete!\n");
  console.log("  Default logins:");
  console.log("  ─────────────────────────────");
  console.log("  superadmin / admin123  (Super Admin)");
  console.log("  admin1     / admin123  (Admin)");
  console.log("  admin2     / admin123  (Admin)");
  console.log("  supo       / user123   (Barangay User)");
  console.log("  poblacion  / user123   (Barangay User)");
  console.log("  ... and 8 more barangay users");
}

main().catch(console.error);
