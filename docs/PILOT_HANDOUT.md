# Raze AgroDash — Pilot Handout

> One-document reference for the pilot deployment. Covers what got built, how to operate it, what to apply, what to verify, and what's intentionally left for later. Read this end-to-end before the first pilot session; refer back to specific sections as needed.
>
> **Audience**: the solo developer running the pilot, anyone helping with ops, and a future team member doing onboarding.
>
> **Last updated**: 2026-05-18 (end of Pilot Hardening Week 3)

---

## Table of contents

1. [What this system is](#1-what-this-system-is)
2. [Pilot scope at a glance](#2-pilot-scope-at-a-glance)
3. [Architecture (high level)](#3-architecture-high-level)
4. [Test accounts & local setup](#4-test-accounts--local-setup)
5. [Migrations — what to apply](#5-migrations--what-to-apply)
6. [What Pilot Hardening shipped (Week 1–3)](#6-what-pilot-hardening-shipped-week-13)
7. [Operating the app — daily checks](#7-operating-the-app--daily-checks)
8. [Debugging](#8-debugging)
9. [Backup, restore, recovery](#9-backup-restore-recovery)
10. [Staging environment](#10-staging-environment)
11. [Incremental rollout plan](#11-incremental-rollout-plan)
12. [Known follow-ups (not yet done)](#12-known-follow-ups-not-yet-done)
13. [Where to look for what](#13-where-to-look-for-what)
14. [Useful URLs, commands, queries](#14-useful-urls-commands-queries)
15. [Commit history reference](#15-commit-history-reference)

---

## 1) What this system is

**Raze AgroDash** is the Agricultural Production Monitoring System for **LGU Tubo, Abra, Region CAR**. It's a Next.js 16 + Supabase web app used by:

- **Super admins** (municipal Agricultural Office)
- **Admins** (municipal staff)
- **Barangay users** (extension workers per barangay)

The app tracks:

- **Farmers** (registry, household membership, organization affiliations, per-farmer assets)
- **Households** (planting capacity, subsidies)
- **Agricultural records** (a single planting/stocking cycle per row, with lifecycle status `active → harvested/damaged → archived`)
- **Land assets** (per-parcel planting areas — Phase A onward)
- **Organizations** (cooperatives, associations, household groups)
- **Activity logs** (append-only audit trail of every mutation)

Domain rules (commodity-field isolation, status-evidence gates, allocation capacity, severity classification) live in `lib/domain/*` and are unit-testable independently of React or Supabase.

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, Radix UI primitives |
| Validation | Zod 4 |
| Charts | Recharts 3 |
| Backend | Supabase (Auth + Postgres + RLS) |
| Exports | DOCX (`docx`), CSV (RFC-4180, UTF-8 BOM), HTML print |

---

## 2) Pilot scope at a glance

Per the original pilot-readiness plan, the goal is **operational stability and reliability**, not new features. The architecture was already capable; the gap was operational maturity.

| Scope decision | Choice |
|---|---|
| Timeline | 3–4 weeks (now complete — Week 1–3 shipped) |
| Bilingual UI | English-only with terminology softening (Tagalog deferred) |
| Error reporting | Supabase `app_errors` table (no Sentry) |
| Soft delete | Core tables only (agri_records, farmers, households, farmer_assets) |
| Pilot users | Barangay extension workers in LGU Tubo |
| Rollout | Phased: internal → 1 barangay → multi-barangay → municipal |

---

## 3) Architecture (high level)

Strict directionality: **UI → context → domain + helpers + data access → Supabase**.

```
app/                          ← Next.js routes (App Router)
  layout.tsx                  ← root layout, mounts <Providers>
  page.tsx                    ← dashboard shell, tab routing, deep-links
  error.tsx                   ← segment-level error boundary (Pilot Hardening)
  global-error.tsx            ← root-level error boundary (Pilot Hardening)
  admin/restore/page.tsx      ← admin-only soft-delete restore (Pilot Hardening)
  print/page.tsx              ← print view

components/
  providers.tsx               ← <ErrorBoundary><AuthProvider><ErrorBoundary><AgriDataProvider>
  LoginPage.tsx               ← credentials form + sessionExpired + restoreError banners
  ErrorBoundary.tsx           ← class component for sub-tree isolation (Pilot Hardening)
  AuthLoadingSkeleton.tsx     ← rendered during AuthProvider loading phase
  dashboard/                  ← KpiCards, DataTable, charts, dialogs, etc.
    ProviderLoadBanner.tsx    ← partial-load failure banner (Pilot Hardening Week 3)
  ui/
    EmptyState.tsx            ← shared empty-state surface (Pilot Hardening)
    ConfirmDialog.tsx         ← reused by confirm-on-finalize (Pilot Hardening)

lib/
  data.ts                     ← types: AgriRecord, Farmer, Household, AppError, ...
  agri-context.tsx            ← orchestrator: loads 7 tables, owns mutations, nests 4 providers
  auth-context.tsx            ← Supabase auth wrapper + role/barangay + sessionExpired + restoreError
  activity-log.ts             ← logActivity() fire-and-forget writer + retry queue (Pilot Week 3)
  error-log.ts                ← reportError() fire-and-forget writer (Pilot Hardening)
  debug.ts                    ← gated lifecycle logger (Pilot Hardening Week 3)
  normalize.ts                ← Supabase row → TS type
  insert-rows.ts              ← TS type → Supabase columns
  validations.ts              ← Zod schemas (form validation)
  domain/
    commodity.ts              ← CommodityGroup + group resolver
    status.ts                 ← RecordStatus + labels (with friendlier copy per Pilot Hardening)
    lifecycle.ts              ← transition table + evidence gates
    allocation.ts             ← household + asset capacity validators
    validation.ts             ← validateDomainRecord + formatDomainIssues
    warnings.ts               ← DataWarning channel + findDuplicateFarmer (Pilot Hardening)
    metrics.ts                ← all aggregators (traceAggregation-wrapped)
    activity.ts               ← Phase Next diff helpers + summary builders
    severity.ts, units.ts, invariants.ts, audit.ts, utilization.ts
  contexts/
    farmers-context.tsx       ← FarmersProvider + useFarmers()
    programs-context.tsx      ← ProgramsProvider + usePrograms()
    records-context.tsx       ← RecordsProvider + useRecords()
    metrics-context.tsx       ← MetricsProvider + useMetrics()
    activity-context.tsx      ← Phase Next bare hooks (no Provider)
    load-status-context.tsx   ← Pilot Hardening Week 3: useAgriLoadStatus()
  supabase/
    client.ts                 ← browser client (lazy Proxy singleton)
    server.ts                 ← server component client
    middleware.ts             ← session refresh on every request
    errors.ts                 ← Postgres error code → user-friendly message

migrations/                   ← 21 SQL migrations (001..021), idempotent
  rollback/                   ← paired rollback scripts for 020 + 021

system docs/
  System Architecture.md      ← canonical app-side architecture spec (~840 lines)
  Database Architecture.md    ← canonical DB-side spec
  Phase 1 Domain Model.md     ← domain spec
  Phase A Land Asset Allocation.md
  Phase Next Activity Timeline.md

docs/
  BACKUP_RUNBOOK.md           ← daily pg_dump, dry-run, recovery (Pilot Hardening Week 3)
  STAGING_SETUP.md            ← second-Supabase-project workflow (Pilot Hardening Week 3)
  PILOT_HANDOUT.md            ← this file
```

### Provider tree

```
<ErrorBoundary label="AuthProvider">
  <AuthProvider>                              ← session restore, role, sessionExpired, restoreError
    <ErrorBoundary label="AgriDataProvider">
      <AgriDataProvider>                      ← loads 7 tables, owns all mutations
        <AgriLoadStatusProvider>              ← Pilot Week 3: loadErrors + retryLoad
          <FarmersProvider value={...}>       ← farmers + assets + farmer_orgs
            <ProgramsProvider value={...}>    ← households + orgs + subsidies
              <RecordsProvider value={...}>   ← agri_records + 3 mutations
                <MetricsProvider>             ← 22 derived summaries (hook-fed)
                  {children}
```

A render-time crash inside `AgriDataProvider` is caught by its boundary and doesn't unmount `AuthProvider` — the user can still log out / log back in.

### Domain rules at a glance

- **Three commodity groups**: CROP (hectares + bags), FISHERY (pieces), LIVESTOCK (heads). No unit conversion between groups — bags ↔ MT for CROP only.
- **Lifecycle status**: `active → harvested | damaged → archived`. Self-transitions allowed. `archived` is terminal (no transitions out).
- **Dual-mode allocation**: a CROP record either belongs to a household (legacy pool) OR to a specific LAND asset (Phase A onward). Both validators run per record.
- **Validation layers**: Zod (form shape) → `validateDomainRecord` (commodity isolation + status evidence, now wired client + server) → DB CHECK constraints. Plus `validateHouseholdCropAllocation` and `validateLandAssetAllocation` for capacity.

For full detail see [`system docs/System Architecture.md`](../system%20docs/System%20Architecture.md).

---

## 4) Test accounts & local setup

### Test credentials

| Username | Password | Role | Barangay |
|---|---|---|---|
| `superadmin` | `admin123` | SUPER_ADMIN | — (sees all) |
| `admin1` | `admin123` | ADMIN | — (sees all) |
| `admin2` | `admin123` | ADMIN | — |
| `supo` | `user123` | BARANGAY_USER | Supo |
| `poblacion` | `user123` | BARANGAY_USER | Poblacion |
| `wayangan` | `user123` | BARANGAY_USER | Wayangan |
| `kili` | `user123` | BARANGAY_USER | Kili |
| `tiempo` | `user123` | BARANGAY_USER | Tiempo |
| `amtuagan` | `user123` | BARANGAY_USER | Amtuagan |
| `tabacda` | `user123` | BARANGAY_USER | Tabacda |
| `alangtin` | `user123` | BARANGAY_USER | Alangtin |
| `dilong` | `user123` | BARANGAY_USER | Dilong |
| `tubtuba` | `user123` | BARANGAY_USER | Tubtuba |

**Important**: change these passwords before the real pilot. Pilot users get fresh credentials communicated out-of-band.

### Run locally

```bash
git clone https://github.com/Razeflow/raze-agrodash.git
cd raze-agrodash
npm install

# Copy env template; fill in your Supabase URL + anon key
cp .env.example .env.local
# Edit .env.local with your real Supabase project URL + anon key

npm run dev
# → http://localhost:3000
```

### Required environment variables

| Var | Where used | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server + middleware | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server + middleware | Public anon JWT or publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts only (seed, admin tasks) | Never `NEXT_PUBLIC_`. Never commit. |

`.env.local` is gitignored. `.env.example` is the template that goes to git.

### Useful npm scripts

```
npm run dev            # start dev server (Turbopack)
npm run build          # production build
npm run start          # start production build
npm run lint           # ESLint
npm run seed:supabase  # bulk seed data into Supabase (uses service role key)
```

---

## 5) Migrations — what to apply

The pilot deployment needs **all 21 migrations** applied in order. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) so re-running is safe.

| # | File | Phase | What it does |
|---|---|---|---|
| 001 | `001_households_orgs.sql` | Foundation | Households, orgs, farmer_organizations, profiles columns, RLS |
| 002 | `002_household_subsidies.sql` | Foundation | Per-household subsidies + RLS |
| 003 | `003_calamity_sub_category.sql` | Foundation | `calamity_sub_category` column |
| 004 | `004_organizations_admin_only.sql` | Foundation | Tightens org write policies |
| 005 | `005_farmer_household_head.sql` | Foundation | `is_household_head` flag |
| 006 | `006_auto_profile_trigger.sql` | Foundation | Profiles auto-sync trigger |
| 007 | `007_farmer_assets.sql` | Foundation | `farmer_assets` table + RLS |
| 008 | `008_records_check_constraints.sql` | Foundation | Numeric sanity bounds on agri_records |
| 009 | `009_farmer_assets_livestock.sql` | Foundation | Livestock category for farmer_assets |
| 010 | `010_records_lifecycle_status.sql` | Foundation | `lifecycle_status` column (legacy) |
| 011 | `011_phase1_domain_model.sql` | Phase 1 | `commodity_group`, new `status`, fishery_loss_pieces, livestock_*_heads |
| 012 | `012_validate_phase1_constraints.sql` | Phase 1 | Validates Phase 1 constraints after backfill |
| 013 | `013_phase2_domain_enforcement.sql` | Phase 2 | `crop_damage_leq_area`, status-evidence CHECKs |
| 014 | `014_validate_phase2_constraints.sql` | Phase 2 | Validates Phase 2 constraints |
| 015 | `015_archived_terminal_trigger.sql` | Phase 2 | BEFORE UPDATE OF status trigger; archived is terminal |
| 016 | `016_agri_records_rls.sql` | Phase 5 | Enables RLS on `agri_records` + barangay index |
| 017 | `017_land_allocation.sql` | Phase A | `farmer_asset_id` FK + linkage trigger + view + RPC |
| 018 | `018_farmer_assets_reset.sql` | Phase A | One-time reset of `farmer_assets` (reconciliation; safe to skip if your env wasn't affected) |
| 019 | `019_activity_logs.sql` | Phase Next | `public.activity_logs` append-only audit table + 3 indexes + RLS |
| **020** | `020_soft_delete.sql` | **Pilot Hardening Week 1** | `deleted_at` columns + partial indexes on 4 core tables |
| **021** | `021_app_errors.sql` | **Pilot Hardening Week 1** | `public.app_errors` table for caught-exception triage + RLS |

### How to apply

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Open `migrations/<filename>` locally, copy contents, paste in editor, click **Run**
3. Run the verification queries in the footer of each migration to confirm success
4. Move to the next migration

After applying 020 + 021, force PostgREST to refresh its schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

(Or just wait ~30 seconds — it auto-refreshes.)

### Rollbacks

Migrations 020 and 021 have paired rollback scripts in `migrations/rollback/`. For 001–019 (no rollback files), write the inverse SQL ad-hoc and document it in your incident log.

**Do NOT auto-apply rollbacks**. Run them only after a `pg_dump` is taken seconds before, and only via the SQL Editor with service-role credentials.

---

## 6) What Pilot Hardening shipped (Week 1–3)

The pilot-readiness plan identified 10 areas of operational improvement. Here's what shipped in each.

### Stability hardening (plan §1)

| Improvement | File(s) |
|---|---|
| Global error boundary (route-segment) | `app/error.tsx` |
| Root-level error boundary | `app/global-error.tsx` |
| Sub-tree error boundary class wrapper | `components/ErrorBoundary.tsx` |
| Per-provider crash isolation | `components/providers.tsx` |
| AuthProvider session-restore try/catch + 10s timeout + skeleton | `lib/auth-context.tsx` |
| Hydration mismatch fix (date in render) | `app/page.tsx` |
| Per-table loadErrors + retryLoad | `lib/agri-context.tsx`, `lib/contexts/load-status-context.tsx` |
| Visible load-failure banner | `components/dashboard/ProviderLoadBanner.tsx` |
| Activity-log retry queue + localStorage fallback | `lib/activity-log.ts` |
| Defensive per-row try/catch in normalize paths | `lib/agri-context.tsx` |

Next 16 specifics:
- Error boundaries use the new `unstable_retry` prop (not the older `reset`)
- Hydration is dev-strict; render-time `new Date()` causes mismatch warnings

### Validation completion (plan §2)

| Improvement | File(s) |
|---|---|
| `formatDomainIssues(issues)` helper | `lib/domain/validation.ts` |
| `validateDomainRecord` wired into RecordFormDialog.validate() | `components/dashboard/RecordFormDialog.tsx` |
| `validateDomainRecord` wired into addRecord/updateRecord (server-side enforcement) | `lib/agri-context.tsx` |

Pre-flight SQL to run BEFORE deploying this change (already done):

```sql
SELECT id FROM agri_records
WHERE (commodity_group = 'CROP' AND COALESCE(planting_area_hectares, 0) <= 0 AND status = 'active')
   OR (commodity_group = 'FISHERY' AND COALESCE(stocking, 0) <= 0 AND status = 'active')
   OR (commodity_group = 'LIVESTOCK' AND COALESCE(livestock_stocking_heads, 0) <= 0 AND status = 'active');
-- Expect 0 rows. If non-zero, fix those records first (set status='archived' or correct values).
```

### Data quality controls (plan §3)

| Improvement | File(s) |
|---|---|
| `DataWarning` shape + soft-warning channel | `lib/domain/warnings.ts` |
| `findDuplicateFarmer` (name + RSBSA) | `lib/domain/warnings.ts` |
| Wired into FarmerFormDialog with "Add Anyway" override | `components/dashboard/FarmerFormDialog.tsx` |

Future warnings (suspicious yield, high damage on non-calamity, incomplete optional fields) plug in via the same shape but are out of pilot scope.

### Soft delete (plan §4)

| Improvement | File(s) |
|---|---|
| Schema: `deleted_at` + partial indexes on 4 tables | `migrations/020_soft_delete.sql` |
| Rollback for 020 | `migrations/rollback/020_rollback.sql` |
| Types extended with `deleted_at?: string \| null` | `lib/data.ts` |
| Normalizers pass `deleted_at` through | `lib/normalize.ts` |
| Load queries filter `.is("deleted_at", null)` on 4 tables | `lib/agri-context.tsx` |
| 4 delete mutations: `.delete()` → `.update({ deleted_at })` | `lib/agri-context.tsx` |
| Defensive guard in `cropActiveAllocationHa` | `lib/domain/allocation.ts` |
| Admin-only restore page (50 rows/table, one-click) | `app/admin/restore/page.tsx` |

**Behavior changes worth knowing:**
- **Household soft-delete** no longer cascades. Subsidies and farmers stay attached. UI lookups for the soft-deleted household return `undefined` — existing `?.field ?? ""` defenses handle that. Restoration is lossless.
- **Farmer soft-delete** no longer strips `agri_records.farmer_ids`. Records keep their historical farmer attribution. Restoration is lossless.
- **Permanent delete** is not exposed in UI. Service-role SQL only (90-day cleanup template in migration footer).

### Backup & recovery readiness (plan §5)

See [`docs/BACKUP_RUNBOOK.md`](BACKUP_RUNBOOK.md). Covered topics: Supabase Pro auto-backup verification, daily `pg_dump` with crontab + cloud sync, 30-day local retention, quarterly dry-run restore into Docker Postgres, real-recovery flow into a fresh Supabase project, migration rollback flow, operational triage checklist.

### UX simplification (plan §6)

| Improvement | File(s) |
|---|---|
| Friendlier status labels ("Currently Growing", "Harvest Recorded", "Closed") | `lib/domain/status.ts` |
| Long-form variants for verbose contexts | `lib/domain/status.ts` (`RECORD_STATUS_LONG_LABELS`) |
| Status chip styling drops uppercase + tracking-wide | `components/dashboard/DataTable.tsx` |
| Shared `EmptyState` component | `components/ui/EmptyState.tsx` |
| DataTable: distinguishes filter-empty from truly-empty with appropriate CTA | `components/dashboard/DataTable.tsx` |
| Confirm-on-finalize before terminal status transitions | `components/dashboard/RecordFormDialog.tsx` |
| Session-expiry friendly handling + banner | `lib/auth-context.tsx`, `components/LoginPage.tsx` |
| RestoreError friendly banner (when session restore times out) | `lib/auth-context.tsx`, `components/LoginPage.tsx` |
| Sub-Category Breakdown + Records filter now include Livestock | `components/dashboard/SubCategoryAnalytics.tsx`, `components/dashboard/DataTable.tsx` |

### Pilot deployment checklist (plan §7)

This document IS the handout that captures the plan's deployment checklist content. The verification checklist in Section 14 below is paste-ready.

### Operational logging & monitoring (plan §8)

| Improvement | File(s) |
|---|---|
| `app_errors` table + RLS (mirrors `activity_logs` shape) | `migrations/021_app_errors.sql` |
| `AppError` type + `appErrorInsertRow` | `lib/data.ts`, `lib/insert-rows.ts` |
| `reportError(err, { context, actor })` fire-and-forget writer | `lib/error-log.ts` |
| Error boundaries call `reportError` on catch | `app/error.tsx`, `app/global-error.tsx`, `components/ErrorBoundary.tsx` |
| Admin restore page calls `reportError` on operational failures | `app/admin/restore/page.tsx` |
| Activity-log retry queue (Week 3) | `lib/activity-log.ts` |
| Provider-load error surface with Retry (Week 3) | `lib/contexts/load-status-context.tsx`, `components/dashboard/ProviderLoadBanner.tsx` |
| `lib/debug.ts` gated lifecycle logger | `lib/debug.ts` |

### Performance & scalability (plan §9)

Already adequate for pilot scale (1–3 barangays, <1000 farmers/barangay). Specific deferrals documented in `system docs/System Architecture.md` §16. Watch the 7-table `Promise.all` load time after 1 month of pilot data; if it exceeds 1.5s, split critical-now vs lazy.

### Incremental rollout plan (plan §10)

See Section 11 below.

---

## 7) Operating the app — daily checks

Spend **5 minutes per pilot-day** doing this. Pin it as a daily morning habit.

### 7.1 Health check — Supabase Studio queries

Bookmark these in your Supabase SQL Editor.

**What broke yesterday:**

```sql
SELECT created_at, username, message, context, url
FROM public.app_errors
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

**Today's mutation activity by barangay:**

```sql
SELECT barangay, action, count(*)
FROM public.activity_logs
WHERE created_at > current_date
GROUP BY barangay, action
ORDER BY barangay, count DESC;
```

**Households nearing capacity (≥90% allocated):**

```sql
SELECT h.barangay, h.display_name,
       h.farming_area_hectares AS capacity,
       COALESCE(SUM(r.planting_area_hectares), 0) AS used,
       ROUND(100.0 * COALESCE(SUM(r.planting_area_hectares), 0) / NULLIF(h.farming_area_hectares, 0), 1) AS pct
FROM public.households h
LEFT JOIN public.agri_records r
  ON r.household_id = h.id
  AND r.status = 'active'
  AND r.commodity_group = 'CROP'
  AND r.deleted_at IS NULL
WHERE h.deleted_at IS NULL
GROUP BY h.id
HAVING COALESCE(SUM(r.planting_area_hectares), 0) >= h.farming_area_hectares * 0.9
ORDER BY pct DESC NULLS LAST;
```

**Soft-deleted rows older than 60 days (consider hard-deleting):**

```sql
SELECT 'agri_records' AS t, count(*) FROM public.agri_records
WHERE deleted_at < now() - interval '60 days'
UNION ALL SELECT 'farmers', count(*) FROM public.farmers
WHERE deleted_at < now() - interval '60 days'
UNION ALL SELECT 'households', count(*) FROM public.households
WHERE deleted_at < now() - interval '60 days'
UNION ALL SELECT 'farmer_assets', count(*) FROM public.farmer_assets
WHERE deleted_at < now() - interval '60 days';
```

**Activity-log retry queue size** (in-browser only — open DevTools console on the app):

```js
JSON.parse(localStorage.getItem('agro:activity-log-retry') || '[]').length
```

### 7.2 In-app sweep

1. Open `/admin/restore` — if there's anything you don't recognize, investigate (could be a user who deleted by accident)
2. Open the Activity tab — scan the last 24h for unusual patterns (mass deletes, status changes at odd hours, allocation_overflow_attempt entries)
3. Check a barangay user's view by signing in as them once a week — confirm they only see their barangay (RLS sanity)

### 7.3 Backup verification

- Confirm yesterday's `pg_dump` file exists in `~/agrodash-backups/`
- Confirm cloud sync (S3/GDrive/etc.) has it too
- Quarterly: run the dry-run restore (see `docs/BACKUP_RUNBOOK.md` §3)

---

## 8) Debugging

### Enable verbose lifecycle logs

In the app, open DevTools console and run:

```js
localStorage.setItem('agro:debug', '1');
location.reload();
```

You'll see namespaced `[agro]` logs:

```
[agro] ▶ mount AuthProvider @+69ms
[agro] Auth: getSession() start
[agro] ↪ Auth: loading → ready { reason: 'ok', hasSession: true }
[agro] ▶ mount AgriDataProvider @+136ms { isLoggedIn: true, retryCounter: 0 }
[agro] AgriData: fetching 7 tables
[agro] ⏱ AgriData.load 234.1ms
[agro] ↪ AgriData: loading → ready { records: 123, farmers: 300, ... }
```

To disable:

```js
localStorage.removeItem('agro:debug');
```

You can also build with `NEXT_PUBLIC_DEBUG=1` to enable for everyone in that build.

### Reading error boundaries in dev

In `NODE_ENV !== 'production'` (i.e. `npm run dev`), the three error boundaries show an open `<details>` block with `error.name`, `error.message`, and the full stack inline. In production, those are hidden to avoid leaking internals.

### Common diagnostics

| Symptom | First-thing-to-check |
|---|---|
| White screen on reload | Browser DevTools → Network tab → look for `getSession()` call hanging or rejecting. Check Supabase project status. If hung, the 10s timeout will surface a friendly banner. |
| "Couldn't load activity." red box | Migration 019 not applied. See Section 5. |
| Dashboard data missing | Migration 020 not applied (or pg_dump restore from before 020). Look for partial-load banner. |
| Login fails silently | Network tab → look for the auth POST. Check `app_errors` table for caught exceptions. |
| Form submit fails | Check the form's error message (now surfaces via `validateDomainRecord`). Check `app_errors`. Check `activity_logs` for the last successful mutation. |
| Soft-deleted row not appearing | Open `/admin/restore`. If not there, check `deleted_at IS NOT NULL` directly in Supabase Studio. |

---

## 9) Backup, restore, recovery

Full details in [`docs/BACKUP_RUNBOOK.md`](BACKUP_RUNBOOK.md). Quick reference here.

### Daily backup (one-line cron)

```bash
0 4 * * * pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public \
  | gzip > "$HOME/agrodash-backups/$(date -u +\%Y-\%m-\%d).sql.gz"
```

Get `AGRO_DB_URL` from **Supabase → Settings → Database → Connection string**.

### Recovery decision tree

```
Data went wrong. Discover scope.
│
├─ One record / few rows, all soft-deletable
│   → /admin/restore page. Click Restore. Done.
│
├─ Recent (<1h), broader scope
│   → Supabase Dashboard → Database → Backups → Restore (Pro tier).
│     Coordinate with pilot users to stop writing while you restore.
│
├─ Older than 24h
│   → pg_dump file from ~/agrodash-backups/.
│     Restore into a FRESH Supabase project (don't overwrite the broken one).
│     Update .env.local to point at the new project.
│     Smoke-test, then promote.
│
└─ Schema corruption / bad migration
    → Roll back the migration (paired script in migrations/rollback/).
      Then handle the data as above based on time window.
```

### Pre-incident habits

- **Pin** the daily Supabase queries above
- **Schedule** the dry-run restore for one calendar day per quarter
- **Document** every minor incident in a one-line log — even if you handled it perfectly, future-you will thank present-you

---

## 10) Staging environment

Full setup in [`docs/STAGING_SETUP.md`](STAGING_SETUP.md). Summary:

1. Create a SECOND Supabase project named `agrodash-staging` (Free tier is fine)
2. Apply all 21 migrations to it in order
3. Seed it with `scripts/seed-supabase-bulk.ts` using the staging service-role key
4. Maintain `.env.staging` locally (gitignored); swap it into `.env.local` when you want to point the app at staging

**Always apply migrations to staging first**, then prod. The handout has a worked example at the bottom of `docs/STAGING_SETUP.md`.

**Never** pull prod data into staging (PII + RLS confusion). If you absolutely need a recent prod snapshot to debug, use `pg_dump` into a THIRD diagnostic-only project.

---

## 11) Incremental rollout plan

Per the original pilot-readiness plan §10. Days are calendar days, not work days.

### Phase 0 — Internal testing (Days 1–7)

- Single test account on prod environment
- You yourself: create 20 farmers, 50 records across 2 barangays
- Drive every workflow once: add/edit/finalize/soft-delete/restore/export
- Run through the verification checklist (Section 14 below)
- Apply the daily backup + dry-run restore at least once

**Exit criteria**: every checklist item ticked or explicitly waived with a written reason.

### Phase 1 — One-barangay pilot (Days 8–21)

- Pick the most engaged extension worker — prefer the one nearest you so in-person support is possible
- 30-minute in-person walkthrough using:
  - A 1-page printed quick-start with screenshots
  - The softened terminology (no jargon)
  - A 5-minute Loom screen recording of one full record entry
- They use it for 2 weeks
- You check `app_errors` and `activity_logs` daily
- Feedback collection: one Google Form linked from the dashboard footer with 3 fields ("What did you try?", "What happened?", "Screenshot")
- Stabilization: any blocker fix ships within 24h. Non-blockers queue for end of Phase 1.

**Exit criteria**: 5+ consecutive days with **zero** `app_errors` rows from this user.

### Phase 2 — Multi-barangay (Days 22–42)

- Add 2–3 more barangays only after Phase 1's exit criteria are met
- Group training session (or 1-on-1 if remote)
- Continue daily Studio check-ins; add a weekly recap email to yourself

**Exit criteria**: 2+ weeks of multi-barangay stability + no critical bug reports.

### Phase 3 — Municipal (Day 43+)

- Roll out to the rest of the municipality
- This is out of scope for the original pilot plan. Re-plan when you get here.

### Training strategy

- 1-page printed quick-start (English, softened terminology) — hand to each new user
- 5-minute Loom screen recording walking through one full record entry — host unlisted
- `docs/FAQ.md` (to-be-created) — grow it as questions come in

### Support strategy

You are the only support channel. Make it sustainable:

- One fixed daily check-in window (e.g., 9–10 am)
- Users can SMS/message you anytime, but expect responses only in that window unless `app_errors` shows a blocker
- Document recurring questions in `docs/FAQ.md`

### Feedback collection

Single Google Form. Three fields:

1. "What did you try to do?"
2. "What happened?"
3. "Screenshot (optional)"

Link it from a small "?" or "Feedback" link in the dashboard footer. Review weekly.

---

## 12) Known follow-ups (not yet done)

The original pilot plan's anti-goals plus deferred items from Weeks 1–3.

### Deferred (might do later)

| # | What | Why deferred | Effort |
|---|---|---|---|
| 1 | Wrap the ~9 `console.error` sites in `agri-context.tsx` mutations + form dialogs with `reportError()` so failed mutations surface to `app_errors` | Cheapest remaining visibility win; originally Week 3 backlog | ~30 min |
| 2 | `docs/FAQ.md` and `docs/PILOT_CHECKLIST.md` | Will grow organically once pilot starts | n/a |
| 3 | Tagalog/bilingual UI | English-only with softened terms is enough for Phase 1; revisit based on real feedback | sizable (i18n scaffolding) |
| 4 | Vercel preview deployments per PR | Manual SQL-editor migrations are fine at pilot scale | small |
| 5 | Activity-log retention auto-prune (currently manual) | `activity_logs` grows ~200 bytes/mutation; table size won't be a concern until year 3+ | small (CRON + migration) |
| 6 | `app_errors` retention auto-prune | Same as above; 90-day manual cleanup template in migration 021 footer | small |
| 7 | `middleware.ts` → `proxy.ts` rename | Next 16 dev-warning only; not breaking | ~10 min |

### Intentionally not in scope (anti-goals)

- **No Sentry/Datadog/PostHog** — `app_errors` + Supabase Studio is the entire monitoring story for pilot.
- **No `app_errors` dashboard UI** — Studio works fine. `UserActivityPanel` is the obvious template if a UI surface becomes necessary later.
- **No anonymous error capture** — `app_errors` RLS INSERT requires auth. Pre-login crashes (e.g. in `LoginPage` mount) fall through to `console.error` only.
- **No form-data preservation on session expiry** — Banner only; form state is lost on the auth bounce. Adds complexity for marginal value.
- **No "permanent delete" UI** — Soft delete + service-role SQL is the full lifecycle. Avoiding a destructive admin button is itself the safety control.
- **No request-level retry wrapper** — Only the activity-log retry queue exists. Mutations don't auto-retry; the user does.
- **No streaming exports** — Current 10,000-row cap is adequate for pilot scale.

### Pre-existing system follow-ups (not pilot-related)

From `system docs/System Architecture.md` §16:

- `useCallback` wrap on mutations (true re-render isolation)
- Full state separation (true Phase F)
- More component migrations off `useAgriData()`
- DOCX export partial migration
- `profiles_update_own` escalation vector (`Database Architecture.md` §11 item 1)
- Phase E — PostGIS swap + map UI
- `scripts/schema.sql` is partial (bootstraps only 3 tables)
- Activity-log DB-trigger safety net

---

## 13) Where to look for what

| If you want to… | Read |
|---|---|
| Understand the application architecture | [`system docs/System Architecture.md`](../system%20docs/System%20Architecture.md) |
| Understand the database schema, RLS, migrations | [`system docs/Database Architecture.md`](../system%20docs/Database%20Architecture.md) |
| Read the canonical domain spec | [`system docs/Phase 1 Domain Model.md`](../system%20docs/Phase%201%20Domain%20Model.md) |
| Understand land asset allocation | [`system docs/Phase A Land Asset Allocation.md`](../system%20docs/Phase%20A%20Land%20Asset%20Allocation.md) |
| Understand the activity timeline | [`system docs/Phase Next Activity Timeline.md`](../system%20docs/Phase%20Next%20Activity%20Timeline.md) |
| Understand the pilot hardening overlay (Week 1–3) | `System Architecture.md` §17 |
| Restore from a backup | [`docs/BACKUP_RUNBOOK.md`](BACKUP_RUNBOOK.md) |
| Set up a staging environment | [`docs/STAGING_SETUP.md`](STAGING_SETUP.md) |
| Add a new commodity, status, or validation rule | `lib/domain/` (see `System Architecture.md` §3) |
| Tighten validation | `lib/validations.ts` + `lib/domain/validation.ts` + add a migration |
| Trace a metric back to source | `lib/domain/metrics.ts` + `scripts/test-metrics.ts` |
| Capture a new caught-exception site | wrap the catch with `void reportError(err, { context: { fn: '...' } })` |
| Add a new soft-warning rule | `lib/domain/warnings.ts` |
| Toggle the debug logger | `localStorage.setItem('agro:debug', '1')` then reload |

---

## 14) Useful URLs, commands, queries

### Local URLs (with dev server running)

- `http://localhost:3000/` — main dashboard (login or app)
- `http://localhost:3000/admin/restore/` — admin-only soft-delete restore (note trailing slash)
- `http://localhost:3000/print/` — print view

### Commands

```bash
# Dev
npm run dev                                   # http://localhost:3000
npm run build                                 # production build
npm run lint                                  # ESLint
npx tsc --noEmit                              # TypeScript check, no emit
npx tsc --noEmit ; echo "exit=$?"            # ditto with exit code

# Seed
SUPABASE_SERVICE_ROLE_KEY=... npm run seed:supabase

# Backup (set AGRO_DB_URL first, see BACKUP_RUNBOOK.md)
pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public \
  | gzip > "$HOME/agrodash-backups/$(date -u +%Y-%m-%d).sql.gz"

# Dry-run restore into local Docker Postgres
docker run --rm -d --name agrodash-restore \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=agrodash_restore \
  -p 5433:5432 postgres:16
gunzip -c ~/agrodash-backups/<date>.sql.gz \
  | psql "postgres://postgres:local@localhost:5433/agrodash_restore"
```

### Pre-pilot verification checklist

Tick each before the first real pilot user signs in.

**Pre-deployment**

- [ ] All 21 migrations applied to prod and verified via footer queries
- [ ] `validateDomainRecord` pre-flight SQL returns 0 rows on prod (Section 6)
- [ ] `app_errors` table accepts inserts (force a throw from a logged-in test account; verify a row appears)
- [ ] Global error boundary renders on a forced throw (temporarily add `throw new Error("test")` in `app/page.tsx`, verify the boundary catches it, then revert)
- [ ] Soft-delete round-trip works: create record → delete → list excludes → `/admin/restore` shows → click Restore → list includes again
- [ ] Empty states render correctly on a brand-new barangay account
- [ ] Session-expiry flow lands on login with the amber banner
- [ ] Pre-prod Supabase keys rotated; staging keys differ from prod
- [ ] Backup script ran successfully at least once
- [ ] Dry-run restore worked at least once
- [ ] `next build` passes with no TypeScript or ESLint errors

**Data integrity**

- [ ] No records with `status='active'` and impossible base size (pre-flight SQL)
- [ ] No household with active allocation > capacity
- [ ] No orphan `farmer_assets` (every `farmer_id` exists in `farmers`)
- [ ] All barangays in production data are in the canonical list (`BARANGAYS` in `lib/data.ts`)

**Onboarding**

- [ ] Pilot user accounts created with real credentials (not the test passwords)
- [ ] Each user has the correct `barangay` set in their profile
- [ ] RLS verified: log in as a barangay user, confirm cannot see other barangays
- [ ] Quick-start handout printed and ready

**Rollback (must rehearse once)**

- [ ] Documented sequence: revert app deploy → revert DB migration → restore from `pg_dump`
- [ ] Rehearsed end-to-end on staging
- [ ] On-call contact identified (you) with expected response time

**Monitoring**

- [ ] Bookmarked Supabase Studio queries for `app_errors` + activity by barangay + households near capacity (Section 7.1)
- [ ] Daily 5-minute check-in habit established (block on calendar)

### Daily monitoring queries

See Section 7.1 above. Copy them into Supabase SQL Editor saved queries.

---

## 15) Commit history reference

The Pilot Hardening work spans 10 commits on `docs/feature-overview`. Quick reference:

```
baf7996 docs: System + Database Architecture — Pilot Hardening Week 3 overlay
a8d6801 docs: backup runbook + staging env setup (Pilot Hardening Week 3 item 13)
b28c255 feat: provider-load error surface (Pilot Hardening Week 3 item 12)
55a1749 feat: activity-log retry queue (Pilot Hardening Week 3 item 11)
e9c6135 fix: Livestock missing from Sub-Category Breakdown + Records filter
ffa7af3 fix: white-screen-on-reload + provider crash isolation + hydration race
8d54f06 docs: Database Architecture — migrations 020 + 021 + soft-delete behavior
55ae624 docs: System Architecture — Pilot Hardening Week 1–2 overlay
632600d feat: pilot-readiness Week 2 — UX softening, dup detection, session expiry
927c28f feat: pilot-readiness Week 1 — error visibility, validation, soft delete
```

| Week | Theme | Code commits | Doc commits |
|---|---|---|---|
| 1 | Operational visibility, validation, soft delete | `927c28f` | `55ae624`, `8d54f06` |
| 2 | UX softening, dup detection, session expiry | `632600d` | — (folded into W1–2 doc) |
| White-screen fix (between W2 + W3) | Auth race + hydration | `ffa7af3` | — |
| Livestock fix (out-of-band bug) | Filter dropdown completeness | `e9c6135` | — |
| 3 | Resilience + operational runbooks | `55a1749`, `b28c255` | `a8d6801`, `baf7996` |

---

## Appendix: original pilot-readiness plan reference

The complete original plan lives at `~/.claude/plans/i-need-help-preparing-synchronous-phoenix.md` on the developer's machine. It captures the 10 areas of pilot readiness, the scope decisions made together, and the verification approach. This handout is the operational realization of that plan.

---

*If you're a new team member reading this, start with Section 3 (architecture), then Section 7 (daily checks), then the in-product Activity tab to see what the system actually does. Skim everything else.*

*If you're operating an in-progress pilot, Section 7 and Section 9 are your daily references.*

*If something broke and you're panicking, Section 9 has the decision tree.*
