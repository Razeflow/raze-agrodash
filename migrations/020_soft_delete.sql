-- AgriDash: Pilot Hardening — soft-delete on core entity tables.
--
-- Converts agri_records, farmers, households, farmer_assets from hard-delete
-- to soft-delete by adding a nullable `deleted_at` column. Hard-delete paths
-- in scripts/* keep working; the app-side mutations swap to UPDATE.
--
-- Out of scope (stay hard-delete):
--   - household_subsidies, organizations, farmer_organizations
--     These are configuration-like or join rows; restoring them adds churn
--     without clear operational value.
--
-- Idempotent: safe to re-run.
--
-- Required prerequisites:
--   - migrations 001..019 applied
--
-- After this migration:
--   - Four tables gain `deleted_at TIMESTAMPTZ NULL`.
--   - Four partial indexes on `(barangay) WHERE deleted_at IS NULL` keep the
--     hot-path "live rows by barangay" scans fast (the app filters every
--     SELECT to live rows by default).
--   - RLS policies are unchanged: soft-delete is a normal UPDATE and the
--     existing UPDATE policies on these tables already permit it under the
--     same barangay/role rules. No new policies needed.
--   - FK ON DELETE CASCADE behavior is NOT affected by soft-delete (since we
--     no longer DELETE). Callers that previously relied on cascade are now
--     responsible for either preserving references (preferred — clean
--     restoration) or running a deliberate hard-delete via SQL.
--
-- Rollback: migrations/rollback/020_rollback.sql

-- =========================================================================
-- 1) Columns
-- =========================================================================

ALTER TABLE IF EXISTS public.agri_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS public.farmers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS public.households
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS public.farmer_assets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.agri_records.deleted_at IS
  'Soft-delete marker. NULL = live, non-NULL = hidden. App load queries '
  'always filter to deleted_at IS NULL. Restoration via app/admin/restore.';
COMMENT ON COLUMN public.farmers.deleted_at IS
  'Soft-delete marker. See agri_records.deleted_at.';
COMMENT ON COLUMN public.households.deleted_at IS
  'Soft-delete marker. Note: subsidies and farmers keep their household_id '
  'after soft-delete so restoration is lossless. Service-role hard-delete '
  'is still required to truly remove a household and cascade dependents.';
COMMENT ON COLUMN public.farmer_assets.deleted_at IS
  'Soft-delete marker. See agri_records.deleted_at.';

-- =========================================================================
-- 2) Partial indexes — hot path is "live rows by barangay"
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_agri_records_active
  ON public.agri_records (barangay) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_farmers_active
  ON public.farmers (barangay) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_households_active
  ON public.households (barangay) WHERE deleted_at IS NULL;

-- farmer_assets is scoped by farmer_id (and indirectly by farmer.barangay).
-- Partial-index the FK so "live assets for this farmer" stays cheap.
CREATE INDEX IF NOT EXISTS idx_farmer_assets_active
  ON public.farmer_assets (farmer_id) WHERE deleted_at IS NULL;

-- =========================================================================
-- Verification queries (run manually in SQL Editor after applying):
-- =========================================================================
--
--   -- 1. All four tables have deleted_at
--   SELECT table_name
--   FROM information_schema.columns
--   WHERE table_schema='public'
--     AND column_name='deleted_at'
--     AND table_name IN ('agri_records','farmers','households','farmer_assets')
--   ORDER BY table_name;
--   -- expect 4 rows
--
--   -- 2. All four partial indexes exist
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname='public' AND indexname IN (
--     'idx_agri_records_active','idx_farmers_active',
--     'idx_households_active','idx_farmer_assets_active'
--   ) ORDER BY indexname;
--   -- expect 4 rows
--
--   -- 3. Soft-delete round-trip smoke test (run as a barangay user via app):
--   --    INSERT a test record → DELETE in app → confirm row has deleted_at
--   --    set and is excluded from the app list.
--   SELECT id, barangay, commodity, deleted_at
--   FROM public.agri_records
--   WHERE deleted_at IS NOT NULL
--   ORDER BY deleted_at DESC
--   LIMIT 5;
--
-- Privileged hard-delete (run from SQL Editor with service role only — not
-- from the app):
--
--   -- After 90 days, permanently remove soft-deleted core rows.
--   DELETE FROM public.agri_records   WHERE deleted_at < now() - interval '90 days';
--   DELETE FROM public.farmer_assets  WHERE deleted_at < now() - interval '90 days';
--   DELETE FROM public.farmers        WHERE deleted_at < now() - interval '90 days';
--   DELETE FROM public.households     WHERE deleted_at < now() - interval '90 days';
