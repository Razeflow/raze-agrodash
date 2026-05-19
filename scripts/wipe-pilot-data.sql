-- =========================================================================
-- Pre-pilot full data wipe (aggressive version).
-- =========================================================================
--
-- Removes EVERYTHING in the public schema so the pilot starts truly fresh.
-- Audit history and organizations included — the user signalled all of it
-- is mock and they want a clean slate before importing real RSBSA data.
--
-- WIPED (10 tables):
--   - public.agri_records          — planting/harvest rows
--   - public.farmer_organizations  — farmer ↔ org memberships
--   - public.household_subsidies   — RFFA / subsidy line items
--   - public.farmer_assets         — per-farmer planting-area lots + machinery
--   - public.farmers               — farmer registry
--   - public.households            — household groups
--   - public.organizations         — coops / associations
--   - public.profiles              — auth.user → role/barangay mapping
--   - public.activity_logs         — audit history of mutations
--   - public.app_errors            — error visibility log
--
-- INTENTIONALLY KEPT:
--   - auth.users                   — login credentials. See "AUTH USERS"
--                                    section below if you want them gone too.
--   - All migrations / schema       — the structure itself stays.
--
-- USAGE
--   1. Run pg_dump FIRST. Irreversible otherwise.
--        pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public \
--          | gzip > "$HOME/agrodash-backups/pre-wipe-$(date -u +%Y-%m-%d_%H%M).sql.gz"
--      For full safety include the auth schema too:
--        pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public --schema=auth \
--          | gzip > "$HOME/agrodash-backups/pre-wipe-with-auth-$(date -u +%Y-%m-%d_%H%M).sql.gz"
--
--   2. Supabase Dashboard → SQL Editor → New query → paste this entire file
--      → Run. The SQL Editor uses service-role credentials so RLS is bypassed.
--
--   3. Verify (see queries at the bottom). All ten wiped tables should
--      report 0 rows; auth.users should retain its row count.
--
--   4. NEXT STEP: run scripts/import-rsbsa.sql to load real farmer data
--      from the SRBSA roster, then recreate pilot user accounts via
--      Supabase Dashboard → Authentication.
--
-- AUTH USERS
--   public.profiles has `id UUID PRIMARY KEY REFERENCES auth.users(id) ON
--   DELETE CASCADE`. Deleting profiles does NOT delete auth.users — the
--   FK only cascades the other direction. After this wipe, any existing
--   auth.users become "orphaned": they can still authenticate, but the app
--   will fail to look up their role/barangay because the profile row is
--   gone, and the auto-profile trigger from migration 006 only fires on
--   `AFTER INSERT ON auth.users`, NOT on subsequent logins.
--
--   To also delete auth.users (truly fresh start), uncomment the marked
--   block in section 4 below. Profiles will cascade-delete automatically.
--   You'll then need to recreate pilot accounts via Supabase Dashboard →
--   Authentication → Add User, setting raw_user_meta_data → role
--   (SUPER_ADMIN / ADMIN / BARANGAY_USER) and barangay so the
--   auto-profile trigger populates the right values.
--
-- SAFETY
--   Wrapped in a single transaction. If any DELETE errors out (e.g. FK
--   constraint we missed), the whole wipe rolls back atomically.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1) Entity data (child rows before parents).
-- ─────────────────────────────────────────────────────────────────────

-- agri_records references farmers, households, farmer_assets — first.
DELETE FROM public.agri_records;

-- farmer_organizations references farmers + organizations.
DELETE FROM public.farmer_organizations;

-- household_subsidies references households.
DELETE FROM public.household_subsidies;

-- farmer_assets references farmers.
DELETE FROM public.farmer_assets;

-- farmers references households (ON DELETE SET NULL).
DELETE FROM public.farmers;

-- households — no remaining FK references after the above.
DELETE FROM public.households;

-- organizations — referenced by farmer_organizations (gone) +
-- households.organization_id (ON DELETE SET NULL, harmless).
DELETE FROM public.organizations;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Audit history (append-only by design but the user wants a clean slate).
-- ─────────────────────────────────────────────────────────────────────

DELETE FROM public.activity_logs;
DELETE FROM public.app_errors;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Profiles (auth.user ↔ role/barangay mapping).
-- ─────────────────────────────────────────────────────────────────────
--   auth.users are kept. Existing auth.users will sign in but the app
--   will not be able to look up their role/barangay until you either:
--     (a) Re-INSERT into profiles manually (per user), OR
--     (b) Run the backfill from migration 006 (after the wipe):
--           INSERT INTO public.profiles (id, username, display_name, role, barangay)
--           SELECT id, …, 'BARANGAY_USER', NULL FROM auth.users
--           WHERE id NOT IN (SELECT id FROM public.profiles);
--         then UPDATE role/barangay per user.

DELETE FROM public.profiles;

-- ─────────────────────────────────────────────────────────────────────
-- 4) OPTIONAL: also delete auth.users (truly fresh start).
-- ─────────────────────────────────────────────────────────────────────
--   Uncomment if you want to nuke every login credential too. Profiles
--   are already empty from step 3, so this just clears the auth-schema
--   row that the trigger fires on. After this, ALL existing logins stop
--   working — recreate users via Supabase Dashboard → Authentication →
--   Add User.

-- DELETE FROM auth.users;

COMMIT;

-- =========================================================================
-- Verification queries (run after COMMIT).
-- =========================================================================
--
-- Wiped — expect 0 for all ten:
--
--   SELECT 'agri_records'         AS t, count(*) FROM public.agri_records
--   UNION ALL SELECT 'farmers',             count(*) FROM public.farmers
--   UNION ALL SELECT 'households',          count(*) FROM public.households
--   UNION ALL SELECT 'farmer_assets',       count(*) FROM public.farmer_assets
--   UNION ALL SELECT 'farmer_organizations',count(*) FROM public.farmer_organizations
--   UNION ALL SELECT 'household_subsidies', count(*) FROM public.household_subsidies
--   UNION ALL SELECT 'organizations',       count(*) FROM public.organizations
--   UNION ALL SELECT 'profiles',            count(*) FROM public.profiles
--   UNION ALL SELECT 'activity_logs',       count(*) FROM public.activity_logs
--   UNION ALL SELECT 'app_errors',          count(*) FROM public.app_errors;
--
-- Kept — sanity check the wipe didn't overshoot:
--
--   SELECT count(*) AS auth_users FROM auth.users;
--   -- Expect non-zero unless you uncommented section 4.
--
-- App-side smoke after running the import script:
--   1. Sign in. If auth.users were kept but profiles wiped, you'll get a
--      "no profile" symptom. Run the backfill SQL from above to fix.
--   2. After running scripts/import-rsbsa.sql, the Farmers tab should
--      show ~1100 farmers across 10 barangays (the unique-by-RSBSA count
--      from the SRBSA roster — see the import script header for the
--      exact post-dedup total).
