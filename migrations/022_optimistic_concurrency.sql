-- AgriDash: Pilot Hardening Week 3.5 — optimistic-concurrency trigger for the
-- four soft-deletable tables (agri_records, farmers, households, farmer_assets).
--
-- The app-side helper (lib/concurrency.ts → updateWithConcurrency) issues
-- UPDATE … WHERE id = $1 AND updated_at = $2 against these tables. If the
-- row's updated_at differs from the client's last-seen value (i.e. someone
-- else wrote in the meantime) the UPDATE returns 0 rows and the helper
-- surfaces a friendly "Someone else updated this …" message in the dialog.
--
-- This migration adds a BEFORE UPDATE trigger that bumps updated_at to now()
-- on every UPDATE — so clients can't bypass the check by replaying their old
-- updated_at value in the payload. The trigger is the defense-in-depth half;
-- the helper's WHERE-clause filter is the load-bearing half. Either alone is
-- enough; both together is correct.
--
-- Why we chose this over a version INTEGER column or xmin:
--   - Reuses the existing updated_at column (no new column, no backfill,
--     no normalize.ts / data.ts type churn).
--   - xmin is unreliable through PostgREST (filtered out + comparison
--     semantics are surprising across transaction boundaries).
--   - Triggers are append-only and isolated; rollback is a 4-line DROP.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE
-- TRIGGER. Safe to re-run.
--
-- Required prerequisites:
--   - migrations 001..021 applied (in particular: the four target tables
--     exist with an updated_at TIMESTAMPTZ column, all from scripts/schema.sql).
--
-- After this migration:
--   - public.touch_updated_at() exists.
--   - Four triggers (trg_touch_agri_records, trg_touch_farmers,
--     trg_touch_households, trg_touch_farmer_assets) fire BEFORE UPDATE on
--     their respective tables and overwrite NEW.updated_at with now().
--
-- Coexistence with existing triggers:
--   - migration 015 (agri_records_archived_terminal_trg, BEFORE UPDATE OF
--     status) still fires on agri_records UPDATEs and may raise; trigger
--     execution order is alphabetical so the archived-terminal check runs
--     before the updated_at bump. No logic conflict.
--
-- Rollback: migrations/rollback/022_rollback.sql

-- =========================================================================
-- 1) Trigger function
-- =========================================================================
--
-- Plain SECURITY INVOKER (the default). We never want this running with
-- elevated privileges — it's a write-time bookkeeping touch, nothing more.
--
-- No IS DISTINCT FROM OLD guard: a no-op UPDATE bumping updated_at is fine.
-- It signals "touched" without changing concurrency semantics. The cost of
-- the unconditional assign is negligible vs the OLD/NEW comparison.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.touch_updated_at() IS
  'BEFORE UPDATE trigger function: overwrites NEW.updated_at with now() so '
  'clients cannot bypass the optimistic-concurrency check (see lib/concurrency.ts) '
  'by replaying a stale updated_at value in their payload.';

-- =========================================================================
-- 2) Triggers — one per soft-deletable table
-- =========================================================================

DROP TRIGGER IF EXISTS trg_touch_agri_records ON public.agri_records;
CREATE TRIGGER trg_touch_agri_records
  BEFORE UPDATE ON public.agri_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_farmers ON public.farmers;
CREATE TRIGGER trg_touch_farmers
  BEFORE UPDATE ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_households ON public.households;
CREATE TRIGGER trg_touch_households
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_farmer_assets ON public.farmer_assets;
CREATE TRIGGER trg_touch_farmer_assets
  BEFORE UPDATE ON public.farmer_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- Verification queries (run manually in SQL Editor after applying):
-- =========================================================================
--
--   -- 1. Function exists and is owned by the right schema.
--   SELECT n.nspname AS schema, p.proname AS fn, l.lanname AS lang
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   JOIN pg_language  l ON l.oid = p.prolang
--   WHERE n.nspname='public' AND p.proname='touch_updated_at';
--   -- expect 1 row: public | touch_updated_at | plpgsql
--
--   -- 2. All four triggers present and bound to the right tables.
--   SELECT event_object_table AS table, trigger_name, action_timing, event_manipulation
--   FROM information_schema.triggers
--   WHERE trigger_schema='public'
--     AND trigger_name LIKE 'trg_touch_%'
--   ORDER BY trigger_name;
--   -- expect 4 rows, all BEFORE UPDATE.
--
--   -- 3. Behavioural smoke test — pick any row, try to lie about updated_at.
--   --    Replace <id> with a real UUID from agri_records.
--   --
--   --    UPDATE public.agri_records
--   --    SET    updated_at = '2020-01-01T00:00:00Z'
--   --    WHERE  id = '<id>';
--   --
--   --    SELECT updated_at FROM public.agri_records WHERE id = '<id>';
--   --    -- expect: a fresh now()-time value, NOT 2020-01-01.
--
--   -- 4. Repeat (3) for the other three tables (farmers, households, farmer_assets).
--
--   -- 5. Coexistence smoke (agri_records only): a record currently `archived`
--   --    should still raise from the migration-015 trigger if you try to
--   --    transition out of `archived` — order of triggers is alphabetical
--   --    (agri_records_archived_terminal_trg before trg_touch_agri_records).
--
-- Forcing PostgREST to refresh schema is NOT required for triggers — they
-- are transparent to the REST layer. If you've also applied an app-side
-- change in the same window that adds columns/views, run:
--   NOTIFY pgrst, 'reload schema';
