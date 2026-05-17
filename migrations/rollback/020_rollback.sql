-- Rollback for migration 020_soft_delete.sql.
--
-- Do NOT auto-apply. Run from SQL Editor with service role only if 020 needs
-- to be reverted. Strips the deleted_at columns and partial indexes.
--
-- Pre-rollback warning: this drops the deleted_at columns, which means any
-- rows currently soft-deleted will become visible again (their delete state
-- is lost). If that is undesirable, hard-delete them first:
--
--   DELETE FROM public.agri_records   WHERE deleted_at IS NOT NULL;
--   DELETE FROM public.farmer_assets  WHERE deleted_at IS NOT NULL;
--   DELETE FROM public.farmers        WHERE deleted_at IS NOT NULL;
--   DELETE FROM public.households     WHERE deleted_at IS NOT NULL;
--
-- Order: drop indexes → drop columns. Idempotent.

BEGIN;

DROP INDEX IF EXISTS public.idx_agri_records_active;
DROP INDEX IF EXISTS public.idx_farmers_active;
DROP INDEX IF EXISTS public.idx_households_active;
DROP INDEX IF EXISTS public.idx_farmer_assets_active;

ALTER TABLE IF EXISTS public.agri_records   DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE IF EXISTS public.farmers        DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE IF EXISTS public.households     DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE IF EXISTS public.farmer_assets  DROP COLUMN IF EXISTS deleted_at;

COMMIT;

-- Post-rollback verification:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND column_name='deleted_at';
--   -- expect 0 rows
