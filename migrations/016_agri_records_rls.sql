-- AgriDash: Row-Level Security on agri_records.
--
-- Phase 5 / security hardening.
-- Mirrors the policy shape used by households, household_subsidies, and
-- farmer_assets (see migrations 001, 002, 007).
-- Idempotent: safe to re-run.
--
-- Required prerequisites:
--   - public.profiles exists with `id`, `role`, `barangay` (migration 001 + 006)
--   - public.get_user_role() and public.get_user_barangay() are defined as
--     STABLE SECURITY DEFINER SQL functions (see scripts/schema.sql §3)
--   - Every row in public.agri_records has a non-NULL barangay
--
-- After this migration:
--   - SUPER_ADMIN / ADMIN: full SELECT / INSERT / UPDATE / DELETE on every row
--   - BARANGAY_USER:       only rows where agri_records.barangay matches
--                          their profiles.barangay
--   - WITH CHECK on INSERT and UPDATE blocks writing rows whose `barangay`
--     differs from the caller's profile barangay (i.e. no "moving" a row
--     into another barangay).

-- 1) Pre-flight: refuse to enable RLS if any row is missing a barangay.
DO $$
DECLARE null_count BIGINT;
BEGIN
  SELECT count(*) INTO null_count FROM public.agri_records WHERE barangay IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enable RLS on agri_records: % row(s) have NULL barangay. Backfill them first, then re-run.',
      null_count;
  END IF;
END $$;

-- 2) Index supporting the policy's `barangay =` check.
--    No-op if it already exists (e.g. installed via scripts/full-setup.sql).
CREATE INDEX IF NOT EXISTS idx_agri_records_barangay
  ON public.agri_records(barangay);

-- 3) Enable RLS (idempotent — Postgres emits a NOTICE if already enabled).
ALTER TABLE public.agri_records ENABLE ROW LEVEL SECURITY;

-- 4) Policies. Drop-then-create so re-runs land cleanly.

-- SELECT
DROP POLICY IF EXISTS "agri_records_select" ON public.agri_records;
CREATE POLICY "agri_records_select" ON public.agri_records
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- INSERT — WITH CHECK only; barangay users must write rows tagged with their barangay.
DROP POLICY IF EXISTS "agri_records_insert" ON public.agri_records;
CREATE POLICY "agri_records_insert" ON public.agri_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- UPDATE — both USING (which rows can be touched) AND WITH CHECK (the new
-- state must still satisfy the policy). Without WITH CHECK a barangay user
-- could "transfer" a record by editing its barangay.
DROP POLICY IF EXISTS "agri_records_update" ON public.agri_records;
CREATE POLICY "agri_records_update" ON public.agri_records
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  )
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- DELETE
DROP POLICY IF EXISTS "agri_records_delete" ON public.agri_records;
CREATE POLICY "agri_records_delete" ON public.agri_records
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- Verification queries (run manually in SQL Editor after applying):
--
--   -- Confirm RLS is on
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'agri_records' AND relnamespace = 'public'::regnamespace;
--   -- expect: relrowsecurity = true
--
--   -- Confirm all four policies exist
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'agri_records'
--   ORDER BY policyname;
--   -- expect 4 rows: agri_records_{select,insert,update,delete}
