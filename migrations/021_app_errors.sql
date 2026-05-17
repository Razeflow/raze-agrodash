-- AgriDash: Pilot Hardening — app_errors table for production error visibility.
--
-- Sibling of activity_logs (migration 019) but a distinct channel:
--   - activity_logs    = successful domain mutations (audit trail)
--   - app_errors       = caught exceptions / unexpected failures (operational visibility)
--
-- Written from lib/error-log.ts → reportError() inside catch blocks across the
-- app (mutations, exports, error boundaries). Fire-and-forget: the helper
-- swallows its own errors so instrumentation can never crash the caller.
--
-- Idempotent: safe to re-run.
--
-- Required prerequisites:
--   - migrations 001..020 applied
--   - public.get_user_role() / public.get_user_barangay() exist (migration 001)
--
-- After this migration:
--   - public.app_errors exists with two read-pattern-targeted indexes.
--   - RLS enabled. SELECT/INSERT policies mirror activity_logs (admin sees all;
--     barangay user sees own barangay).
--   - NO UPDATE policy. NO DELETE policy. Errors are append-only — privileged
--     cleanup runs via service role only (see retention footer).
--
-- Rollback: migrations/rollback/021_rollback.sql

-- =========================================================================
-- 1) Table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.app_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Caller identity. Denormalized so logs survive profile edits / deletes.
  -- user_id is nullable for future anon-error capture (not used in pilot).
  user_id         UUID,
  username        TEXT,
  role            TEXT,

  -- RLS scope. NULL allowed: admin-tagged errors (super-admin has no barangay).
  -- Barangay users MUST insert with their own barangay (enforced by RLS).
  barangay        TEXT,

  -- The error itself.
  message         TEXT NOT NULL,
  name            TEXT,        -- Error.name (TypeError, AbortError, ...)
  stack           TEXT,        -- Truncated at app layer (~8KB cap)

  -- Where it happened and what the caller was doing.
  -- `context` is the free-form attachment surface — { fn: 'addRecord', recordId, ... }.
  context         JSONB,
  url             TEXT,        -- window.location.pathname + search
  user_agent      TEXT
);

COMMENT ON TABLE public.app_errors IS
  'Append-only operational error log. Written app-side from lib/error-log.ts '
  'inside catch blocks. RLS-scoped by barangay. No UPDATE or DELETE policies — '
  'errors are immutable by design. Distinct from activity_logs (mutation audit).';

COMMENT ON COLUMN public.app_errors.barangay IS
  'RLS scope. NULL = admin-tagged (super-admin / admin without barangay). '
  'Barangay users can only insert with their own barangay.';
COMMENT ON COLUMN public.app_errors.context IS
  'Free-form JSONB attachment, e.g. { fn: "addRecord", recordId: "...", source: "mutation" }.';
COMMENT ON COLUMN public.app_errors.stack IS
  'Truncated at app layer to keep row size bounded.';

-- =========================================================================
-- 2) Indexes
-- =========================================================================
--
-- Two read patterns drive the index choice:
--   1. "What's broken right now"               (created_at DESC)
--   2. Per-barangay triage (admin or barangay): (barangay, created_at DESC)
--      Partial WHERE barangay IS NOT NULL because NULL = admin-only.

CREATE INDEX IF NOT EXISTS idx_app_errors_created
  ON public.app_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_errors_barangay
  ON public.app_errors (barangay, created_at DESC)
  WHERE barangay IS NOT NULL;

-- =========================================================================
-- 3) RLS
-- =========================================================================

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- SELECT — admin/super-admin see all; barangay user sees own barangay.
-- NULL-barangay rows are admin-only.
DROP POLICY IF EXISTS "app_errors_select" ON public.app_errors;
CREATE POLICY "app_errors_select" ON public.app_errors
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR (barangay IS NOT NULL AND barangay = public.get_user_barangay())
  );

-- INSERT — authenticated user must tag the row with their own barangay
-- (admins may tag any barangay, including NULL).
DROP POLICY IF EXISTS "app_errors_insert" ON public.app_errors;
CREATE POLICY "app_errors_insert" ON public.app_errors
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- NO UPDATE policy. NO DELETE policy. Default-deny under RLS makes the table
-- append-only for every authenticated caller. Retention pruning runs via the
-- service role from the SQL Editor only.

-- =========================================================================
-- Verification queries (run manually in SQL Editor after applying):
-- =========================================================================
--
--   -- 1. Table + columns exist
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='app_errors'
--   ORDER BY ordinal_position;
--   -- expect 11 rows: id, created_at, user_id, username, role, barangay,
--   --                 message, name, stack, context, url, user_agent (12)
--
--   -- 2. Indexes present
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname='public' AND tablename='app_errors'
--   ORDER BY indexname;
--   -- expect 3 rows: app_errors_pkey, idx_app_errors_barangay, idx_app_errors_created
--
--   -- 3. RLS is on and exactly two policies exist
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='app_errors'
--   ORDER BY policyname;
--   -- expect 2 rows: app_errors_insert (INSERT), app_errors_select (SELECT)
--
--   -- 4. RLS append-only smoke test (run as a regular authenticated user):
--   --    UPDATE public.app_errors SET message = 'tampered' WHERE id = '<any-id>';
--   --    expect: 0 rows affected (no UPDATE policy → default deny)
--   --    DELETE FROM public.app_errors WHERE id = '<any-id>';
--   --    expect: 0 rows affected (no DELETE policy → default deny)
--
--   -- 5. Daily triage queries
--   --    SELECT created_at, username, message, context, url
--   --    FROM app_errors
--   --    WHERE created_at > now() - interval '24 hours'
--   --    ORDER BY created_at DESC;
--
-- Retention (run from SQL Editor with service role only, never from the app):
--
--   DELETE FROM public.app_errors
--   WHERE created_at < now() - interval '90 days';
--
-- If the table grows beyond a few million rows, partition by month rather than prune.
