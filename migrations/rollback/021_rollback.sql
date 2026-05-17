-- Rollback for migration 021_app_errors.sql.
--
-- Do NOT auto-apply. Run from SQL Editor with service role only if 021 needs
-- to be reverted (e.g. broken schema or shipping-block discovered post-deploy).
--
-- Order: drop policies → disable RLS → drop indexes → drop table.
-- Idempotent: safe to re-run if a previous attempt partially completed.

BEGIN;

DROP POLICY IF EXISTS "app_errors_select" ON public.app_errors;
DROP POLICY IF EXISTS "app_errors_insert" ON public.app_errors;

ALTER TABLE IF EXISTS public.app_errors DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.idx_app_errors_barangay;
DROP INDEX IF EXISTS public.idx_app_errors_created;

DROP TABLE IF EXISTS public.app_errors;

COMMIT;

-- Post-rollback verification:
--   SELECT to_regclass('public.app_errors');   -- expect NULL
