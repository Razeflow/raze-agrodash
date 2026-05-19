-- Rollback for migration 022_optimistic_concurrency.sql.
--
-- Do NOT auto-apply. Run from SQL Editor with service role only if 022 needs
-- to be reverted (e.g. an unexpected interaction with a future trigger, or
-- if the optimistic-concurrency strategy itself is replaced).
--
-- App-side impact of dropping these triggers:
--   - lib/concurrency.ts → updateWithConcurrency still works. The
--     `eq("updated_at", lastKnownUpdatedAt)` filter remains effective
--     against whatever value the client most recently read. The trigger
--     is defense-in-depth; without it, the only attacker who could bypass
--     the check is one who deliberately replays a stale updated_at value
--     inside their own UPDATE payload — which the app code never does.
--   - All four update functions in lib/agri-context.tsx continue to set
--     updated_at: new Date().toISOString() in their payloads. That keeps
--     the column moving forward even without the trigger.
--
-- Order: drop triggers (in any order) → drop function.
-- Idempotent: safe to re-run if a previous attempt partially completed.

BEGIN;

DROP TRIGGER IF EXISTS trg_touch_agri_records ON public.agri_records;
DROP TRIGGER IF EXISTS trg_touch_farmers      ON public.farmers;
DROP TRIGGER IF EXISTS trg_touch_households   ON public.households;
DROP TRIGGER IF EXISTS trg_touch_farmer_assets ON public.farmer_assets;

DROP FUNCTION IF EXISTS public.touch_updated_at();

COMMIT;

-- Post-rollback verification:
--
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE trigger_schema='public' AND trigger_name LIKE 'trg_touch_%';
--   -- expect 0 rows.
--
--   SELECT proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.proname='touch_updated_at';
--   -- expect 0 rows.
