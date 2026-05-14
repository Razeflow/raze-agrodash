# Phase Next — Activity Timeline & Operational History

This document defines **Phase Next** of the architecture evolution for **Raze AgroDash**. The goal is to give the system operational traceability for every important action — accountability, audit, investigation, monitoring — without bloating contexts, coupling UI to DB, or destabilising the existing domain layer.

Delivered in five sub-phases (1 through 5). A sixth — DB-trigger safety net — is deliberately deferred; the schema reserves room for it.

## Goals (Phase Next only)

- Single append-only `activity_logs` table covering every mutation across `agri_records`, `farmers`, `households`, `farmer_assets`, `organizations`, `household_subsidies`, and `farmer_organizations`.
- Capacity-overflow rejections (the failed-validation branch) become first-class log entries — operational visibility into "users trying to overbook".
- Per-record Timeline UI inside `RecordFormDialog`; cross-cutting investigation panel (admin-only) at the dashboard level.
- CSV export of the audit trail with server-side filters.
- RLS-scoped: barangay users see their own barangay's history; admins see all.
- Domain layer stays pure (zero React, zero Supabase in `lib/domain/*`).

**Non-goals**: real-time subscriptions on `activity_logs`; logging reads; logging schema migrations or seed loads; a heavier "audit dashboard". All deferred until needed.

## 1) Logging model — app-side primary

| | App-side (used) | DB trigger (deferred) |
|---|---|---|
| Captures semantic actions | ✅ The mutation function knows it's a `status_changed`, not just an UPDATE. | ❌ Would need to diff OLD/NEW JSON to infer intent. |
| Performance | ✅ One extra INSERT per mutation, optimistic, fail-soft. | ❌ Synchronous; a bug in the trigger fails the user's write. |
| `performed_by_name` | ✅ Already snapshotted from `useAuth()`. | ❌ Needs an `auth.uid()` → profiles JOIN inside plpgsql. |
| Catches direct SQL | ❌ Bypassed. | ✅ Defense in depth. |
| Solo-dev maintenance cost | Low (one helper, one call site per mutation). | High (function per table, careful diffing). |

The single weakness of app-side — direct SQL bypass — doesn't apply today: there's no service-role usage on the server and SQL Editor work is admin one-offs. The schema reserves `source = 'db_trigger'` so the safety net can be added later without churn (Phase Next §6).

## 2) Schema (migration 019)

```sql
CREATE TABLE public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type     TEXT NOT NULL,   -- CHECK: 7 controlled values
  entity_id       UUID NOT NULL,   -- no FK (polymorphic across 7 parent tables)
  action          TEXT NOT NULL,   -- CHECK: 13 controlled values

  before          JSONB,           -- changed fields only; NULL on creates
  after           JSONB,           -- changed fields only; NULL on deletes
  summary         TEXT,            -- pre-rendered one-liner for the timeline UI

  performed_by        UUID,        -- profiles.id (nullable for future trigger rows)
  performed_by_name   TEXT,        -- denormalised so logs survive profile edits
  performed_by_role   TEXT,

  barangay        TEXT NOT NULL,   -- RLS scope; 'ALL' sentinel for cross-barangay orgs
  source          TEXT NOT NULL DEFAULT 'app',   -- 'app' | 'db_trigger' (CHECK)
  metadata        JSONB,           -- free-form (overflow values, cascade counts, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Three composite indexes, all with `created_at DESC` baked in so newest-first reads are index-only:

| Index | Drives |
|---|---|
| `(entity_type, entity_id, created_at DESC)` | Per-record Timeline tab. |
| `(barangay, created_at DESC)` | Cross-cutting User Activity panel. |
| `(performed_by, created_at DESC) WHERE performed_by IS NOT NULL` (partial) | "Show me everything user X did." |

**RLS**: SELECT + INSERT only (mirroring `agri_records` migration 016). **No UPDATE policy, no DELETE policy** — Postgres default-denies when RLS is on and no policy matches, so logs are append-only for every authenticated caller. Privileged cleanup (retention pruning) must run via the service role from the SQL Editor; migration 019's footer documents a manual `DELETE WHERE created_at < ...` pattern.

## 3) Code layout

```
lib/data.ts                          ← ActivityLog type + ActivityAction / EntityType enums
                                       (kept in lockstep with the SQL CHECK constraints)

lib/domain/activity.ts               ← PURE: diff helpers (pickChangedFields, pickFields,
                                       changedKeys), action resolvers (resolveAgriRecordUpdateAction,
                                       resolveFarmerUpdateAction), summary builders per entity,
                                       logged-field lists per entity. Zero React, zero Supabase.

lib/activity-log.ts                  ← IMPURE WRITE: logActivity({...}) → supabase insert.
                                       Fail-soft: console-warns on error, never throws,
                                       never rolls back the user's main mutation.

lib/contexts/activity-context.tsx    ← IMPURE READ: bare hooks (no Provider).
                                       - useActivityLog(entityType, entityId)  → per-record
                                       - useActivityFeed(filter)               → cross-cutting
                                       Both cursor-paginated on (created_at DESC, id DESC).

lib/normalize.ts                     ← + normalizeActivityLog(row): JSONB-as-string fallback,
                                       enum validation, ISO timestamp coercion.

lib/insert-rows.ts                   ← + activityLogInsertRow(log): single source of column mapping.

lib/agri-context.tsx                 ← 24+ mutation call-sites each emit one logActivity(...)
                                       after a successful Supabase write. Auth snapshot held
                                       in actorRef (refreshed via effect on useAuth() change).

lib/export-activity-csv.ts           ← exportActivityCsv(filter): walks cursor in 500-row pages,
                                       caps at 10,000, builds RFC-4180 CSV with UTF-8 BOM +
                                       CRLF (Excel-friendly), triggers browser blob download.

components/dashboard/RecordTimeline.tsx
                                     ← Per-record panel mounted inside RecordFormDialog.
                                       Day-grouped (PH timezone), action-colored chips,
                                       relative timestamps under a week.

components/dashboard/UserActivityPanel.tsx
                                     ← Admin-only cross-cutting panel mounted as the
                                       "Activity" tab in app/page.tsx. Five-filter bar,
                                       paginated table, Export CSV button.
```

**Strict directionality preserved**: `lib/domain/activity.ts` imports nothing from React or Supabase (matches every other domain module). `lib/activity-log.ts` is the only file that calls Supabase for writes; reads live in `lib/contexts/activity-context.tsx`. The new context is a *bare hook*, not a Provider — activity logs never join the orchestrator's preload set, satisfying the "avoid giant context growth" constraint.

## 4) Action vocabulary

Thirteen semantic actions. The resolver picks the most specific label from a diff; the label drives icon + color in the UI, while `before` / `after` always carry every changed field regardless of which label wins.

| Action | When emitted | Primary entity |
|---|---|---|
| `created` | New row inserted. | any |
| `updated` | Catch-all when a more specific label doesn't apply. | any |
| `deleted` | Row deleted (cascade effects in `metadata.cascade`). | any |
| `status_changed` | `agri_records.status` changed to a non-archived state. | `agri_record` |
| `archived` | `agri_records.status` changed *to* `archived`. | `agri_record` |
| `land_allocation_changed` | `farmer_asset_id` or `planting_area_hectares` changed. | `agri_record` |
| `damage_updated` | Any damage field changed and nothing more-specific applies. | `agri_record` |
| `household_transferred` | `farmers.household_id` changed. | `farmer` |
| `allocation_overflow_attempt` | Validator rejected with `kind: 'capacity'` (Phase 4). | `agri_record` |
| `subsidy_added` / `subsidy_updated` / `subsidy_removed` | `household_subsidies` mutations. | `household_subsidy` |
| `org_membership_changed` | `saveFarmerOrganizations` produced any add or remove. | `farmer_organization` |

**Diff-resolution priority** for `agri_records.updated`: `archived` > `status_changed` > `land_allocation_changed` > `damage_updated` > `updated`. One log per mutation; multi-field edits don't fan out into multiple rows.

**Cascade rule**: parent deletes (`deleteFarmer`, `deleteHousehold`, `deleteOrganization`) log a single primary `deleted` row with affected-row counts in `metadata.cascade`. Cascading writes do **not** generate their own per-row logs — that would explode the audit table on bulk operations.

## 5) Payload size policy

Store *only changed fields*, not full row snapshots. `pickChangedFields(before, after, KEYS)` returns `{ before: {…}, after: {…} }` with just the diff, tolerating FP noise on hectare math (1e-6 epsilon) and treating null/undefined/empty-string as equivalent.

- Typical `updated` entry: **~200 bytes** in `before` + `after` combined.
- `created` / `deleted` entries use `pickFields(row, KEYS)` for a one-sided snapshot.
- `summary` is pre-rendered for the UI — the timeline doesn't have to parse JSON for the common case.
- Empty-diff updates are short-circuited inside `logActivity`: no row is written.

A year of dense use at the LGU scale stays well under 1 GB; the API surface for the UI doesn't change at higher volume because reads are cursor-paginated.

## 6) Validation interplay (Phase 4)

The allocation validators in `lib/domain/allocation.ts` return tagged unions:

```ts
export type HouseholdAllocationValidation =
  | { ok: true }
  | { ok: false; message: string; kind: "structure" }
  | { ok: false; message: string; kind: "capacity"; proposedHa; remainingHa; householdId };

export type LandAssetAllocationValidation =
  | { ok: true }
  | { ok: false; message: string; kind: "structure"; ... }
  | { ok: false; message: string; kind: "capacity"; proposedHa; remainingHa; totalHa; assetId; parcelLabel? };
```

In `agri-context.tsx`, after a `!ok` validator result, the call site checks `kind === 'capacity'` and routes through `logHouseholdOverflowAttempt(...)` / `logAssetOverflowAttempt(...)` before returning the rejection message to the form. Structural rejections (missing household, owner mismatch, duplicate cycle, asset not found, wrong category, zero area) stay unlogged — the audit table is for "users trying to overbook", not ordinary form errors.

For `addRecord`, the attempted record's in-memory UUID is captured even though no row was written; `entity_id` has no FK and a real record with the same UUID can never exist (random v4). For `updateRecord`, `entity_id` is the existing row's id, so an investigator can correlate "attempt at 14:02 → eventual successful edit at 14:05".

## 7) RLS strategy

```sql
-- SELECT: admin/super-admin see all; barangay user sees own barangay.
CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- INSERT: any authenticated user, row must be tagged with their barangay
-- (admins can tag any, including the 'ALL' sentinel for cross-barangay orgs).
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    OR barangay = public.get_user_barangay()
  );

-- No UPDATE policy. No DELETE policy. Append-only by default-deny.
```

**Cross-barangay orgs**: `organizations.barangay` is nullable. Org-level activity rows tag `barangay = 'ALL'` so admins see them via the role bypass while barangay users do not — consistent with org writes being admin-only per migration 004.

## 8) UI

### 8.1 Per-record Timeline (Phase 2)

A pill-style tab strip inside `RecordFormDialog`, visible only in edit mode (add mode has no record yet). Two tabs: **Details** (the existing form) and **Timeline** (a new panel).

- Lazy fetch: the panel only queries Supabase when its tab becomes active (`useActivityLog(entityType, entityId, { enabled: active })`).
- Day-grouped via `formatDatePH` (PH timezone, already in `lib/data.ts`).
- Each entry: colored chip + icon + summary + actor (`name · role`) + relative timestamp (`5m ago` → `3h ago` → `2d ago` → full PH datetime past a week).
- States covered: loading, error (with Retry), empty (`"No activity recorded yet."`), populated, has-more (`"Load older"` button).
- 20 rows per page; fetches 21 to detect a 22nd without a round-trip.

### 8.2 User Activity panel (Phase 5)

Admin-only "Activity" tab in `app/page.tsx`. Cross-cutting feed over `useActivityFeed(filter)`.

- Five-filter bar: **Entity** (7 types or "All") · **Action** (13 actions or "All") · **Barangay** (admin pickable; barangay user locked to own) · **From / To** dates.
- Table view: `When · Entity · Action (colored chip) · Summary · Actor · Barangay`. 25 rows per page; cursor-paginated.
- **Export CSV** button in the panel header — pulls all matching rows via `exportActivityCsv`, capped at 10,000.
- Surfaces a transient toast after export ("Exported 1,247 rows" or "truncated at the 10,000-row cap").

### 8.3 Action icon + color palette

Aligned across both UIs — keep `RecordTimeline.ACTION_STYLES` and `UserActivityPanel.ACTION_HUE` in sync.

| Action | Icon | Hue |
|---|---|---|
| `created` | `Plus` | emerald |
| `updated` | `Pencil` | slate |
| `status_changed` | `RefreshCw` | indigo |
| `damage_updated` | `AlertTriangle` | amber |
| `land_allocation_changed` | `MapPin` | sky |
| `archived` | `Archive` | zinc |
| `deleted` | `Trash2` | rose |
| `allocation_overflow_attempt` | `ShieldAlert` | red |
| `household_transferred` | `ArrowRightLeft` | violet |
| `subsidy_*` | `Gift` | teal |
| `org_membership_changed` | `Users` | purple |

## 9) Performance

- **Indexing**: three composite indexes cover the three primary read patterns; `created_at DESC` baked in.
- **Payload size**: changed-fields-only diff + pre-rendered summary keeps typical entries at ~200 bytes.
- **Pagination**: cursor on `(created_at DESC, id DESC)` — never OFFSET/LIMIT (quadratic at scale).
- **Lazy reads**: per-record fetch only fires when the Timeline tab opens; cross-cutting fetch fires when the Activity tab mounts.
- **Stale-fetch guard**: a monotonic `requestSeq` ref drops Supabase responses that are superseded by a newer query.
- **Export cap**: 10,000 rows. Reaching the cap is surfaced to the user with a "narrow filters and re-run" hint.

## 10) Backward compatibility

- Nothing existing is renamed or dropped.
- `activity_logs` is unrelated to existing tables — no FK *into* it; the FK *from* it (`entity_id`) is intentionally untyped (UUID with no FK constraint) because seven different parent tables can be referenced (standard polymorphic-association tradeoff).
- The orchestrator's mutations each gain one `await logActivity(...)` call after the existing `supabase.from(X).insert/update/delete`. Failure of `logActivity` is logged to console but does **not** roll back the user's mutation — losing a log is preferable to losing a user's edit.
- The new context is mounted *outside* `AgriDataProvider` (it's a bare hook, no Provider mount needed) so the existing four split contexts stay exactly as they are.

## 11) Rollout order (Phase Next sub-steps)

| Step | Theme | Major output |
|---|---|---|
| **1 — Schema + helper + agri_records** | Migration 019, `lib/domain/activity.ts`, `lib/activity-log.ts`, normalize/insert plumbing, wire into 3 record mutations | Logs accumulate quietly; no user-visible change. |
| **2 — Timeline UI** | `useActivityLog`, `RecordTimeline`, Details/Timeline tabs in `RecordFormDialog` | Records get a timeline; everything else still silent. |
| **3 — Extend to other entities** | 16 more mutation sites wired (farmers / households / assets / orgs / subsidies / farmer_orgs); 6 new entity summary builders | Full coverage of the 19+ mutation surface. |
| **4 — Allocation-overflow attempts** | Validators upgraded to tagged unions; capacity rejections emit `allocation_overflow_attempt` rows | Operational visibility into overbooking. |
| **5 — Exports & investigation views** | `useActivityFeed`, `exportActivityCsv`, `UserActivityPanel`, admin-only Activity tab | Audit-ready package. |
| **6 — DB-trigger safety net** | ⏸️ deferred. Schema reserves `source = 'db_trigger'`; revisit if service-role server-side writes become routine. | — |

Each step is independently shippable. Stop points are real — Step 1 alone is correct but dormant; Step 2 is the first user-visible value; Step 5 closes the audit story.

## 12) Where to look next

| If you want to … | Read |
|---|---|
| See the log payload shape | `migrations/019_activity_logs.sql` + `lib/data.ts` (ActivityLog type) |
| Understand the diff/resolver helpers | `lib/domain/activity.ts` |
| Trace a single mutation → log entry | `lib/agri-context.tsx` → `lib/activity-log.ts` → `lib/insert-rows.ts:activityLogInsertRow` |
| Understand the read path | `lib/contexts/activity-context.tsx` (`useActivityLog` for per-entity; `useActivityFeed` for filterable) |
| See the timeline UI | `components/dashboard/RecordTimeline.tsx` |
| See the cross-cutting panel | `components/dashboard/UserActivityPanel.tsx` |
| Export to CSV | `lib/export-activity-csv.ts` |
| Understand the wider system | `System Architecture.md` (§3.6, §11) and `Database Architecture.md` (§5, §6, §7) |
