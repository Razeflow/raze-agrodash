-- AgriDash: Phase Next (Activity Timeline) — append-only activity log table.
--
-- Records who did what, when, and how an entity evolved. App-side primary:
-- mutations in lib/agri-context.tsx call lib/activity-log.ts → logActivity()
-- AFTER a successful Supabase write. DB triggers are reserved for a later
-- phase (the `source` column distinguishes 'app' from a future 'db_trigger').
--
-- Idempotent: safe to re-run.
--
-- Required prerequisites:
--   - migrations 001..018 applied
--   - public.get_user_role() / public.get_user_barangay() exist (migration 001 + 006)
--
-- After this migration:
--   - public.activity_logs exists with three composite indexes optimized for the
--     three primary read patterns (per-entity, per-barangay, per-user).
--   - RLS enabled. SELECT and INSERT policies mirror migrations 007 / 016
--     (admin sees all; barangay user sees own barangay; INSERT must tag the
--     row with the caller's barangay unless admin).
--   - NO UPDATE policy. NO DELETE policy. Logs are append-only — once written,
--     they can only be removed via service-role SQL by an explicit privileged
--     cleanup (see verification footer).

-- =========================================================================
-- 1) Table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was touched. entity_type is a semantic label (not a physical table
  -- name) so the log survives table renames. entity_id is a UUID with no FK
  -- because seven different parent tables can be referenced (standard
  -- polymorphic-association tradeoff).
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,

  -- Semantic action. Drives the timeline UI's icon + color.
  action          TEXT NOT NULL,

  -- Diff payload. Store ONLY changed fields, not full row snapshots — keeps
  -- payload at ~200 bytes per typical update. `summary` is a pre-rendered
  -- one-liner so the timeline UI does not have to parse JSON for the common
  -- case.
  before          JSONB,
  after           JSONB,
  summary         TEXT,

  -- Actor snapshot. Denormalized so logs survive profile edits / deletes.
  -- performed_by is nullable for future db_trigger-sourced rows where
  -- auth.uid() may be NULL (e.g. service-role SQL).
  performed_by        UUID,
  performed_by_name   TEXT,
  performed_by_role   TEXT,

  -- RLS scope. Copied from the entity at log time.
  barangay        TEXT NOT NULL,

  -- Source of the log entry. App-side mutations write 'app'; a later phase
  -- may add DB triggers that write 'db_trigger'. The CHECK constraint
  -- reserves room without forcing the trigger path now.
  source          TEXT NOT NULL DEFAULT 'app',

  -- Free-form attachments (e.g. attempted overflow values for an
  -- allocation_overflow_attempt row, or cascade summaries for delete rows).
  metadata        JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT activity_logs_entity_type_check CHECK (entity_type IN (
    'agri_record', 'farmer', 'household', 'farmer_asset',
    'organization', 'household_subsidy', 'farmer_organization'
  )),
  CONSTRAINT activity_logs_action_check CHECK (action IN (
    'created', 'updated', 'deleted',
    'status_changed', 'archived',
    'land_allocation_changed', 'damage_updated',
    'household_transferred', 'allocation_overflow_attempt',
    'subsidy_added', 'subsidy_updated', 'subsidy_removed',
    'org_membership_changed'
  )),
  CONSTRAINT activity_logs_source_check CHECK (source IN ('app', 'db_trigger'))
);

COMMENT ON TABLE public.activity_logs IS
  'Append-only operational history. Written app-side from lib/activity-log.ts '
  'after successful mutations. RLS-scoped by barangay. No UPDATE or DELETE '
  'policies — logs are immutable by design.';

COMMENT ON COLUMN public.activity_logs.entity_id IS
  'UUID of the row in its native table. No FK because seven different parent '
  'tables can be referenced (polymorphic association).';
COMMENT ON COLUMN public.activity_logs.before IS
  'JSONB of CHANGED fields only (not a full row snapshot). NULL on creates.';
COMMENT ON COLUMN public.activity_logs.after IS
  'JSONB of CHANGED fields only. NULL on deletes.';
COMMENT ON COLUMN public.activity_logs.summary IS
  'Pre-rendered one-line description for the timeline UI, e.g. '
  '"active → harvested" or "0.20 ha → 0.40 ha damage".';
COMMENT ON COLUMN public.activity_logs.source IS
  'Origin of the log entry. ''app'' = lib/activity-log.ts; ''db_trigger'' = '
  'reserved for a future safety-net trigger that catches direct SQL writes.';

-- =========================================================================
-- 2) Indexes
-- =========================================================================
--
-- Three composite indexes covering the three primary read patterns:
--   1. Per-entity timeline (the Timeline tab): (entity_type, entity_id, created_at DESC)
--   2. Barangay audit views:                   (barangay, created_at DESC)
--   3. "Show me everything user X did":        (performed_by, created_at DESC)
--
-- `created_at DESC` is baked into each so the most common query — newest
-- first for a single entity — is satisfied index-only.

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_barangay
  ON public.activity_logs (barangay, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_performed_by
  ON public.activity_logs (performed_by, created_at DESC)
  WHERE performed_by IS NOT NULL;

-- =========================================================================
-- 3) RLS
-- =========================================================================

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- SELECT — admin/super-admin see all; barangay user sees own barangay.
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- INSERT — any authenticated user, but row must be tagged with their own
-- barangay (admins can tag any barangay). Mirrors agri_records (migration 016).
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- NO UPDATE policy. NO DELETE policy. Postgres default-denies when RLS is on
-- and no policy matches, so logs become immutable for every authenticated
-- caller. Privileged cleanup (e.g. retention pruning) must run via the
-- service role from the SQL Editor.

-- =========================================================================
-- 4) Realtime publication
-- =========================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- Verification queries (run manually in SQL Editor after applying):
-- =========================================================================
--
--   -- 1. Table + columns exist
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='activity_logs'
--   ORDER BY ordinal_position;
--   -- expect 15 rows: id, entity_type, entity_id, action, before, after,
--   --                 summary, performed_by, performed_by_name,
--   --                 performed_by_role, barangay, source, metadata, created_at
--
--   -- 2. Indexes present
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname='public' AND tablename='activity_logs'
--   ORDER BY indexname;
--   -- expect 4 rows: activity_logs_pkey + the three idx_activity_logs_* above
--
--   -- 3. RLS is on and exactly two policies exist (SELECT, INSERT — no UPDATE/DELETE)
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='activity_logs'
--   ORDER BY policyname;
--   -- expect 2 rows: activity_logs_insert (INSERT), activity_logs_select (SELECT)
--
--   -- 4. RLS append-only smoke test (run as a regular authenticated user):
--   --    UPDATE public.activity_logs SET summary = 'tampered' WHERE id = '<any-id>';
--   --    expect: 0 rows affected (no UPDATE policy → default deny)
--   --    DELETE FROM public.activity_logs WHERE id = '<any-id>';
--   --    expect: 0 rows affected (no DELETE policy → default deny)
--
-- Retention / privileged cleanup (run from SQL Editor with service role only,
-- never from the app):
--
--   DELETE FROM public.activity_logs
--   WHERE created_at < now() - interval '3 years';
--
-- If table size becomes a concern later, partition by month rather than prune.
