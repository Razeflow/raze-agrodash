-- =========================================================================
-- Pre-pilot full data wipe.
-- =========================================================================
--
-- Removes ALL entity data (records, farmers, households, assets, memberships,
-- subsidies) so the pilot user starts with an empty registry. Keeps:
--
--   - public.organizations  — coops/associations reusable across pilot
--   - public.profiles       — pilot users need to log in
--   - auth.users            — same
--   - public.activity_logs  — append-only audit history (orphaned but useful)
--   - public.app_errors     — append-only error history
--
-- USAGE
--   1. Run `pg_dump` FIRST — this is irreversible. See BACKUP_RUNBOOK.md §2.
--      One-liner:
--        pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public \
--          | gzip > "$HOME/agrodash-backups/pre-wipe-$(date -u +%Y-%m-%d_%H%M).sql.gz"
--
--   2. Supabase Dashboard → SQL Editor → New query.
--      The SQL Editor runs with service-role credentials, so RLS is bypassed
--      and bulk deletes are permitted.
--
--   3. Paste this entire file. Click Run. Verify the output (see verification
--      block at the bottom — should report 0 for the six wiped tables).
--
--   4. If the verification fails (any non-zero count), DO NOT proceed to the
--      pilot — investigate which delete didn't fire and why before retrying.
--
-- SAFETY
--   - Wrapped in a single transaction. If any DELETE errors out (e.g. an FK
--     constraint we forgot), the whole wipe is rolled back atomically.
--   - Order matters: child tables deleted before parents so we don't trip
--     FK constraints in the middle of the transaction.
--   - Soft-delete `deleted_at` columns are bypassed — we hard-delete because
--     we want them gone, not hidden.
--
-- AFTER THE WIPE
--   - activity_logs rows that reference now-deleted entity_ids become
--     orphans. They stay in the table (append-only by Phase Next design)
--     but the lookup `JOIN agri_records …` on them returns no row. The
--     summary text + actor + timestamp + before/after JSONB remain useful
--     for historical context. No corrective action needed.
--
--   - Sequences / auto-increment counters: none to reset. All entity IDs
--     are UUIDs (gen_random_uuid / uuid_generate_v4).
--
--   - VACUUM: not needed. Postgres autovacuum handles it; for a one-time
--     prod wipe of ≤1000 rows per table the disk-bloat impact is trivial.
--
-- ROLLBACK
--   Restore the pg_dump from step 1 into a fresh Supabase project, then
--   point the app at it via .env.local. See BACKUP_RUNBOOK.md §3 ("Real
--   recovery flow").

BEGIN;

-- 1) agri_records: references farmers (farmer_ids[]), households,
--    farmer_assets. Delete first so the parents can go.
DELETE FROM public.agri_records;

-- 2) farmer_organizations: references farmers + organizations. Delete
--    before farmers; organizations stay.
DELETE FROM public.farmer_organizations;

-- 3) household_subsidies: references households. Delete before households.
DELETE FROM public.household_subsidies;

-- 4) farmer_assets: references farmers. Delete before farmers.
DELETE FROM public.farmer_assets;

-- 5) farmers: references households (ON DELETE SET NULL per migration 005),
--    so technically households could be deleted first — but order is clearer
--    this way and the SET NULL would still fire harmlessly.
DELETE FROM public.farmers;

-- 6) households: no remaining FK references after the above.
DELETE FROM public.households;

COMMIT;

-- =========================================================================
-- Verification queries (run manually after the COMMIT above):
-- =========================================================================
--
-- Wiped tables — expect 0 rows each:
--
--   SELECT 'agri_records'         AS t, count(*) FROM public.agri_records
--   UNION ALL SELECT 'farmers',             count(*) FROM public.farmers
--   UNION ALL SELECT 'households',          count(*) FROM public.households
--   UNION ALL SELECT 'farmer_assets',       count(*) FROM public.farmer_assets
--   UNION ALL SELECT 'farmer_organizations',count(*) FROM public.farmer_organizations
--   UNION ALL SELECT 'household_subsidies', count(*) FROM public.household_subsidies;
--
-- Kept tables — expect non-zero (sanity check that we didn't over-delete):
--
--   SELECT 'organizations' AS t, count(*) FROM public.organizations
--   UNION ALL SELECT 'profiles',       count(*) FROM public.profiles
--   UNION ALL SELECT 'auth.users',     count(*) FROM auth.users
--   UNION ALL SELECT 'activity_logs',  count(*) FROM public.activity_logs
--   UNION ALL SELECT 'app_errors',     count(*) FROM public.app_errors;
--
-- App-side smoke test after the wipe:
--   1. Reload the app in a browser tab where you're signed in. Each of the
--      Overview / Records / Farmers tabs should show empty states (the
--      EmptyState component from Week 2 will render appropriate copy).
--   2. Click "Register Farmer" → add a real farmer → save. Confirm the
--      farmer appears in the Farmers tab list (registry of 1).
--   3. Click "Add Record" → fill in a record for that farmer → save.
--      Confirm the record appears and the Overview tile updates.
--   4. Check Activity tab — there should be entries for the post-wipe
--      Add Farmer + Add Record actions (proves activity_logs still works).
