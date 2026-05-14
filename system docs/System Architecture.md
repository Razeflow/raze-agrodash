# System Architecture

How **Raze AgroDash** is structured at the application layer: layers, modules, data flow, validation, and conventions. This document focuses on the *application* — for the database side (tables, RLS, migrations, Supabase connection topology), see **`Database Architecture.md`**. For the canonical Phase 1 domain spec, see **`Phase 1 Domain Model.md`**.

Last updated 2026-05-14 after Phase Next (Activity Timeline & Operational History: append-only `activity_logs`, per-record Timeline tab, cross-cutting Activity panel, CSV export).

## 1) Tech stack

- **Next.js 16 (App Router, Turbopack)** — `app/` directory routes; client-first dashboard.
- **React 19 + TypeScript** — strict mode, function components.
- **Tailwind CSS 4 + Radix UI** — utility-first styling with Radix primitives for dialogs/select/tabs.
- **Zod 4** — schema validation for forms and domain payloads.
- **Recharts 3** — dashboard charts.
- **Supabase (`@supabase/ssr` + `@supabase/supabase-js` 2.x)** — Auth + Postgres + RLS. See `Database Architecture.md` for connection details.
- **docx** — DOCX exports.

Two flat directories carry the bulk of the application logic:

```
lib/        — data, domain, supabase, auth, helpers
components/ — dashboard views, dialogs, UI primitives
```

## 2) Layered architecture

```mermaid
flowchart TD
  subgraph UI [UI Layer]
    direction TB
    pages["app/page.tsx<br/>(dashboard shell)"]
    dashboards["components/dashboard/*<br/>KpiCards · DataTable · …"]
    dialogs["components/dashboard/RecordFormDialog<br/>+ record-form/* subcomponents"]
  end

  subgraph CTX [Context Layer]
    direction TB
    auth["AuthProvider<br/>lib/auth-context.tsx"]
    subgraph AGRI [AgriDataProvider — orchestrator]
      direction TB
      farmersP["FarmersProvider<br/>contexts/farmers-context.tsx"]
      programsP["ProgramsProvider<br/>contexts/programs-context.tsx"]
      recordsP["RecordsProvider<br/>contexts/records-context.tsx"]
      metricsP["MetricsProvider<br/>contexts/metrics-context.tsx"]
    end
    facade["useAgriData() facade<br/>(legacy merged shape)"]
  end

  subgraph DOMAIN [Domain Layer — lib/domain/*]
    direction TB
    metrics["metrics.ts<br/>aggregations"]
    lifecycle["lifecycle.ts<br/>status predicates"]
    allocation["allocation.ts<br/>household capacity"]
    severity["severity.ts<br/>damage classification"]
    invariants["invariants.ts<br/>reporting rules"]
    validation["validation.ts<br/>commodity-aware checks"]
    audit["audit.ts<br/>traceAggregation"]
  end

  subgraph HELPERS [App helpers]
    direction TB
    norm["lib/normalize.ts<br/>row → TS shape"]
    insert["lib/insert-rows.ts<br/>TS → column shape"]
    errs["lib/supabase/errors.ts<br/>friendlyDbError"]
  end

  subgraph DATA [Data Access]
    direction TB
    sb["lib/supabase/*<br/>browser + server + middleware"]
  end

  UI --> CTX
  CTX --> DOMAIN
  CTX --> HELPERS
  CTX --> DATA
  DOMAIN -.types only.-> DATA
  HELPERS --> DOMAIN

  DATA --> supabase[("Supabase<br/>Postgres + RLS<br/>(agri_records: migration 016)")]
```

Strict directionality: **UI → context → domain + helpers + data access → Supabase**. The domain layer has no React imports and no Supabase calls — it operates on plain TS values so it can be unit-tested (see `scripts/test-metrics.ts`, 54 passing tests).

After Phase 5, the context layer has **four split contexts** that share an outer orchestrator (`AgriDataProvider`). New components subscribe to the narrow hook they need; `useAgriData()` remains as a legacy merge facade.

## 3) Domain layer (`lib/domain/*`)

The single most important architectural artifact of the Phase 1–4 refactor. Every business rule lives here, isolated from React and from Supabase.

| Module | Exports | Used by |
|---|---|---|
| `commodity.ts` | `CommodityGroup` (`CROP`/`FISHERY`/`LIVESTOCK`), `commodityGroupForCommodity()` | everywhere |
| `commodityRules.ts` | `RULES` per group (labels, base/output/loss units) | form labels |
| `status.ts` | `RecordStatus` (`active`/`harvested`/`damaged`/`archived`), labels, chip styles, `canTransition()` | form dropdown, badges, table chips |
| `lifecycle.ts` | predicates `countsTowardFinalizedProduction`, `countsTowardDamageReports`, `consumesActiveAllocation`, `isHistoricalOnly` + evidence rules + transition table | every aggregator |
| `metrics.ts` | `getCropMetrics`, `getFisheryMetrics`, `getLivestockMetrics`, `getDamageMetrics`, `getDamageSummary`, `getBarangaySummary`, `getLifecycleSummary`, `getCapacitySummary`, `getProductionByCommodity`, `getRiskRanking`, `getTopCommodity` | KpiCards, agri-context, print-report, export |
| `utilization.ts` | `householdUtilization`, `barangayUtilization`, `municipalUtilization`, `releasedCropAreaHa` | `getCapacitySummary` |
| `allocation.ts` | Household path: `validateHouseholdCropAllocation`, `sumHouseholdActiveCropAllocationHa`, `canAllocateCropActiveHa`, `findConflictingActiveCropCycle`. **Asset path (Phase A–D)**: `validateLandAssetAllocation`, `sumActiveLandAssetAllocationHa`, `calculateRemainingLandAssetHa`. **Validator results are tagged unions** with `kind: 'capacity' \| 'structure'`; only capacity rejections become activity logs (Phase Next §4). | `addRecord` / `updateRecord` in agri-context; live remaining hint in `RecordFormDialog`; `LandAllocation` panel |
| `activity.ts` | **Phase Next**: diff helpers (`pickChangedFields`, `pickFields`, `changedKeys`), action resolvers (`resolveAgriRecordUpdateAction`, `resolveFarmerUpdateAction`), summary builders per entity, logged-field lists. Zero React, zero Supabase. | `lib/activity-log.ts`; the 24+ mutation call-sites in `agri-context.tsx` |
| `severity.ts` | `classifyCropDamageSeverity`, `classifyFisheryLossSeverity`, `classifyLivestockLossSeverity`, `maxSeverity`, chip styles | damage views, risk ranking |
| `validation.ts` | `validateDomainRecord` returning structured `DomainIssue[]` | wired but not consumed yet |
| `units.ts` | `Unit`, `cropBagsToMetricTons` (the **only** unit converter; no fishery↔MT, no livestock↔MT) | metrics, charts |
| `invariants.ts` | 7 `check*`/`assert*` pairs (mixed-units, active-excluded, finalized-has-output, damage ≤ planted, household capacity, fishery never MT, only crop converts to MT) | tests; available for runtime assertions |
| `audit.ts` | `traceAggregation`, `WithMeta`, `formatAggregationMeta` | wraps every metric function |
| `index.ts` | Barrel | downstream imports |

### 3.1 Commodity groups

Three groups, derived from `commodity` (Rice / Corn / High Value Crops / Industrial Crops / Fishery / Livestock):

| Group | Base unit | Output unit | Loss unit |
|---|---|---|---|
| `CROP` | hectares | bags (40 kg) | hectares |
| `FISHERY` | pieces | pieces | pieces |
| `LIVESTOCK` | heads | heads | heads |

No converter exists between groups — bags can become MT (×0.04), but pieces and heads have no weight equivalent. This is enforced both by code (`units.ts` only ships one converter) and by the `INV-6`/`INV-7` invariants in `invariants.ts`.

### 3.2 Lifecycle status

Four states with a strict transition table:

```mermaid
stateDiagram-v2
  [*] --> active
  active --> harvested: finalize harvest
  active --> damaged: finalize loss
  harvested --> archived: lock
  damaged --> archived: lock
  archived --> archived: read-only
```

| State | Counts toward production? | Counts toward damage? | Consumes capacity? |
|---|---|---|---|
| `active` | ❌ | depends | ✅ |
| `harvested` | ✅ | residual only | ❌ |
| `damaged` | ❌ | ✅ | ❌ |
| `archived` | ❌ | ❌ | ❌ |

Server-side enforcement: `status_harvest_requires_output`, `status_damage_requires_loss`, and the `BEFORE UPDATE` trigger `agri_records_archived_terminal_trg` (migrations 013, 015 — see `Database Architecture.md` §6).

Client-side: the form dropdown disables impossible transitions via `canTransition(savedStatus, candidate)`.

Backward compatibility: every record carries **both** `status` (Phase 2 canonical) and `lifecycle_status` (legacy `planted`/`damaged`/`harvested`/`total_loss`). `lib/domain/status.ts:recordStatusFromLifecycleStatus()` maps legacy→new; `RecordFormDialog:deriveLifecycleFromStatus()` maps new→legacy on submit.

### 3.3 Metrics & aggregation

Every metric function is **wrapped in `traceAggregation()`** (`audit.ts`). The result carries a non-enumerable `__meta` with label, timing, and record count. Set `NEXT_PUBLIC_DEBUG_METRICS=1` to log a console trace per call. The print report's footer formats this metadata.

Aggregations are **group-scoped**: `getCropMetrics` only touches CROP rows, `getFisheryMetrics` only FISHERY, etc. There is no function that returns a single "total production" number — it's always returned as `{ cropBags, cropTons, fisheryPieces, livestockHeads }` with each value carrying its unit.

### 3.4 Allocation & capacity

**Dual-mode allocation** (Phase A–D, May 2026). A CROP record can be allocated two ways:

1. **Household pool** (legacy / fallback). `households.farming_area_hectares` is the per-household ceiling. The sum of `planting_area_hectares` over all CROP records attributed to the household via `farmer_ids → farmers.household_id` (status `active`) must not exceed the ceiling. Used when `agri_records.farmer_asset_id IS NULL`.

2. **LAND asset (per-lot)**. When the record sets `farmer_asset_id` to a `farmer_assets` row with `category='planting_area'`, capacity is checked against that single lot's `area_hectares`. The sum of active CROP `planting_area_hectares` pointing at the same asset must not exceed it.

Both validators run in parallel for every record (`validateHouseholdCropAllocation` then `validateLandAssetAllocation` in `agri-context.tsx`). The asset path is a no-op when `farmer_asset_id` is null, so legacy records keep working unchanged. Rejection from either surfaces to `RecordFormDialog`'s `errorMsg` banner with the remaining capacity (and the offending lot's label) stated explicitly.

**DB enforcement**:
- The asset linkage itself is enforced by a `BEFORE INSERT OR UPDATE` trigger (`trg_validate_record_asset`, migration 017): the linked asset must be `category='planting_area'`, and its owning farmer must appear in `agri_records.farmer_ids`.
- Capacity overflow is still **not** enforced at the DB layer — direct SQL inserts bypass the sum check. App-only, like the household path.

**Lifecycle rule for the asset path**: only records with canonical `status='active'` consume area. Flipping a record to `harvested`, `damaged`, or `archived` releases the allocation (the record is simply filtered out of the sum).

**Reading utilisation**: the `v_land_asset_allocation` Postgres view and the in-memory `calculateRemainingLandAssetHa()` helper return identical numbers for the same row. The form uses the in-memory helper (already loaded data, reactive to in-flight edits); the `LandAllocation` panel could read either — it currently uses the in-memory path for the same reason.

### 3.5 Severity & risk ranking

Per-group classifiers in `severity.ts` produce `LOW`/`MODERATE`/`HIGH`/`CRITICAL`. Crops use absolute hectare thresholds; fishery and livestock use a percentage of stocking when known, falling back to absolute counts otherwise.

`getRiskRanking` returns a per-barangay row with worst-of-three severity (crop / fishery / livestock) plus the underlying numbers. Currently consumed by the print report; **not yet rendered on the live dashboard**.

### 3.6 Activity & operational history (Phase Next)

Append-only audit trail for every mutation in the system. Lives in three layers:

| Layer | File | Responsibility |
|---|---|---|
| Pure domain | `lib/domain/activity.ts` | Diff helpers, action resolvers, summary builders, logged-field lists per entity. Zero React, zero Supabase. |
| Impure write | `lib/activity-log.ts` | `logActivity({...})` — fail-soft insert into `public.activity_logs`. Console-warns on error but never throws, never rolls back the user's main mutation. |
| Impure read | `lib/contexts/activity-context.tsx` | Two bare hooks (no Provider): `useActivityLog(entityType, entityId)` for the per-record Timeline tab, `useActivityFeed(filter)` for the cross-cutting User Activity panel. Both cursor-paginated. |

**App-side primary, DB triggers deferred**. Every mutation in `agri-context.tsx` (24+ call-sites across 7 entity tables) fires `logActivity(...)` after a successful Supabase write. The orchestrator is the single chokepoint for all writes, holds the auth context, and knows the *semantic* action (not just "an UPDATE happened"). The schema reserves `source = 'db_trigger'` for a future safety net, but no triggers are installed today — see §16.

**Semantic actions, not CRUD verbs**. `resolveAgriRecordUpdateAction(before, after)` picks the most specific label from a diff: `archived` > `status_changed` > `land_allocation_changed` > `damage_updated` > `updated`. `resolveFarmerUpdateAction` similarly promotes `household_transferred` when `household_id` changes. The `before`/`after` payload always carries every changed field regardless of which label wins; the label drives icon + color in the UI.

**Payload size policy**. Store *only the changed fields*, not full row snapshots. `pickChangedFields(before, after, KEYS)` returns `{ before: {…}, after: {…} }` with just the diff, plus a tolerance for floating-point noise on hectare math. A typical update entry is ~200 bytes.

**No-op short-circuit**. `logActivity` skips writes when both `before` and `after` are null (no real change). Saving a form without edits produces no log row.

**Cascade rule**. When a mutation cascades to other rows (e.g. `deleteFarmer` strips farmer_id from `agri_records.farmer_ids[]` and removes farmer_assets), the cascade does **not** generate per-row logs. The primary action logs cascade counts in `metadata.cascade`. Prevents log explosions on bulk operations.

**Overflow attempts**. When `validateHouseholdCropAllocation` or `validateLandAssetAllocation` rejects with `kind: 'capacity'`, a `allocation_overflow_attempt` row is logged with `proposed_ha` / `remaining_ha` / pool identity in `metadata`. Structural rejections (missing household, owner mismatch, duplicate cycle) are deliberately not logged — the audit table stays focused on "users trying to overbook", not ordinary form errors.

## 4) Top-level UI composition

- **Dashboard shell**: `app/page.tsx`
  - Renders tabs (Overview, Damage & Risk, Farmers, Records, **Land**, Programs, **Activity**, Management, Users)
  - Maintains tab state and syncs tab selection into the URL query (`?tab=`).
  - Supports deep-linking into Farmers via `?tab=farmers&farmerId=...&orgId=...`.
  - The Activity tab is admin-or-above only (Phase Next §5); barangay users get per-record history via the Timeline tab inside `RecordFormDialog`.

- **Land Allocation panel** (Phase C): `components/dashboard/LandAllocation.tsx`
  - One row per planting-area asset visible to the user.
  - Per-row: `total_ha`, `utilized_ha`, `remaining_ha`, `active_record_count`, progress bar (green / amber / red by % used).
  - Barangay filter (admin only) and free-text search (lot label or farmer name).
  - Numbers are computed in-memory from `useAgriData().farmerAssets` + `.records` via `lib/domain/allocation.ts`, so the panel stays reactive to in-flight mutations without an extra round trip.

- **User Activity panel** (Phase Next, admin-only): `components/dashboard/UserActivityPanel.tsx`
  - Cross-cutting audit feed over `public.activity_logs`. Five-filter bar: entity type, action, barangay (admin pickable; barangay user locked to own), from-date, to-date.
  - Paginated table: `When · Entity · Action (colored chip) · Summary · Actor · Barangay`. "Load older" appends the next 25 via cursor.
  - **CSV export** in the panel header — pulls all matching rows (capped at 10,000) via `lib/export-activity-csv.ts` and triggers a browser download with a default filename like `activity_supo_agri_record_status_changed_2026-05-14-10-32-15.csv`.

- **Per-record Timeline tab** (Phase Next): inside `components/dashboard/RecordFormDialog.tsx` via `components/dashboard/RecordTimeline.tsx`.
  - New pill-style tab strip shown only in edit mode (no record to time-line in add mode).
  - Lazy fetch: the panel only queries Supabase when its tab becomes active.
  - Day-grouped (PH timezone), icon + colored chip per action, relative timestamps under a week.

- **KPI strip**: `components/dashboard/KpiCards.tsx` — 7 tiles after Phase 4:
  1. Total farmers
  2. Crop production (MT headline, bags + fishery + livestock counts in hint)
  3. Planting area
  4. Damaged area
  5. Top commodity
  6. **Capacity utilization** (Phase 4 — % + ha breakdown + over-allocated flag)
  7. **Active records** (Phase 4 — count + lifecycle hint)

  Filters by barangay or date are passed in as props; the component re-runs aggregations on the filtered slice.

- **Record form**: `components/dashboard/RecordFormDialog.tsx` + `components/dashboard/record-form/*` subcomponents
  - Commodity-aware field rendering: `CropFields`, `FisheryFields`, `LivestockFields` are conditionally shown based on the commodity group.
  - **Status dropdown** drives validation and lifecycle. Editing an existing record disables transitions disallowed from its saved status.
  - **StatusBadge** in the header reflects the live form status.
  - Numeric evidence fields auto-lock when the chosen status is `harvested`, `damaged`, or `archived`.
  - **Land asset selector** (Phase C/D): appears only when the commodity is a crop and at least one farmer is picked. Required for new CROP records when an eligible asset exists on file; optional during edits of legacy rows. Below the dropdown is a live "Remaining: X.XX ha of Y.YY total" hint that excludes the record's own contribution during edits.

- **Farmer Assets dialog**: `components/dashboard/FarmerAssetsDialog.tsx`
  - Adds/edits per-farmer assets (planting area, machinery, fishpond, facility, livestock).
  - When `category='planting_area'`, `parcel_label` and `area_hectares > 0` are required — these are what the asset selector and the Land panel render against.

## 5) Context layer

### 5.1 `AuthProvider` (`lib/auth-context.tsx`)

Wraps Supabase Auth with synthetic emails (`<username>@agridash.local`) and exposes `role` (`SUPER_ADMIN` | `ADMIN` | `BARANGAY_USER`) + `userBarangay`. See `Database Architecture.md` §4 for the full flow.

### 5.2 `AgriDataProvider` — orchestrator (`lib/agri-context.tsx`)

After Phase 5, `AgriDataProvider` is the **orchestrator** that owns:

- Initial Supabase load on auth state change (parallel `Promise.all` of 7 tables)
- Module state (`useState` for each table)
- Refs to latest state (`farmersRef`, `recordsRef`, `householdsRef`, `farmerAssetsRef`) used by mutations to avoid re-renders
- **Barangay-scoped visible slices** (`vr`, `vf`, `vh`, `vo`, `vSubs`, `vAssets`)
- All cross-cutting mutations (e.g. `deleteFarmer` touches records / orgs / assets / farmer_organizations atomically)
- Helper accessors (`getFarmersByIds`, `getHousehold`, `getSubsidiesForHousehold`, etc.)
- Provider composition: nests the four split providers below

It exposes nothing directly — consumers always go through one of the four narrow contexts or the legacy facade.

### 5.3 The four split contexts (Phase 5)

Each lives in `lib/contexts/*-context.tsx`. They're nested by AgriDataProvider in this order so each layer's hooks are available to the next:

```tsx
<FarmersProvider value={farmersValue}>           {/* farmers + assets + farmer_orgs */}
  <ProgramsProvider value={programsValue}>       {/* households + orgs + subsidies */}
    <RecordsProvider value={recordsValue}>       {/* agri_records + 3 mutations */}
      <MetricsProvider>                          {/* derived summaries; reads via hooks */}
        {children}
      </MetricsProvider>
    </RecordsProvider>
  </ProgramsProvider>
</FarmersProvider>
```

| Context | Hook | Owns |
|---|---|---|
| `FarmersContext` | `useFarmers()` | `farmers`, `farmerOrganizations`, `farmerAssets` + 8 mutations (`addFarmer`, `updateFarmer`, `deleteFarmer`, `getFarmersByIds`, `getOrganizationIdsForFarmer`, `saveFarmerOrganizations`, `addFarmerAsset`, `updateFarmerAsset`, `deleteFarmerAsset`, `getAssetsForFarmer`) |
| `ProgramsContext` | `usePrograms()` | `households`, `organizations`, `householdSubsidies` + 10 mutations (`addHousehold`/`updateHousehold`/`deleteHousehold`, org CRUD, subsidy CRUD, `getHousehold`, `getSubsidiesForHousehold`) |
| `RecordsContext` | `useRecords()` | `records` + `addRecord` / `updateRecord` / `deleteRecord` |
| `MetricsContext` | `useMetrics()` | 22 derived summaries: `totalProduction`, `totalFarmers`, `damageSummary`, `lifecycleSummary`, `capacitySummary`, `damageRiskData`, `productionByCommodity`, `organizationStats`, etc. |

The three data contexts are *prop-fed* by AgriDataProvider (so values are bundled in one place; cross-cutting mutations remain coordinated). `MetricsProvider` is *hook-fed* — it sits innermost and reads via `useFarmers()` + `usePrograms()` + `useRecords()` (Phase E flip).

### 5.4 `useAgriData()` — legacy facade

Returns the merged shape of all four contexts:

```ts
export function useAgriData():
  & FarmersContextValue
  & ProgramsContextValue
  & RecordsContextValue
  & MetricsContextValue
```

Existing components keep working unchanged. New components should prefer the narrow hooks for clearer dependencies and (eventually) better re-render isolation.

### 5.5 Mutation behavior

- **Optimistic updates**: client state updates immediately after DB write succeeds; on error the operation rejects and the form surfaces the message.
- **Error translation**: Postgres errors → user-friendly text via `friendlyDbError()` from `lib/supabase/errors.ts`. CHECK violations (code `23514`) match by constraint name.
- **Cross-cutting cleanups**: deletes mirror the DB-side cascades locally (e.g. `deleteFarmer` strips `farmer_id` from records' `farmer_ids[]` arrays). All cross-cutting mutations live in `agri-context.tsx` so the coordination is in one place.

### 5.6 Component migration pattern (KpiCards example)

`components/dashboard/KpiCards.tsx` is the reference example for migrating off `useAgriData()`. Before/after:

```tsx
// Before — one fat hook
const { totalFarmers, totalProduction, records, farmers, households, … } = useAgriData();

// After — declared dependencies
const { totalFarmers, totalProduction, … } = useMetrics();
const { records } = useRecords();
const { farmers } = useFarmers();
const { households } = usePrograms();
```

Benefit: explicit dependency graph; future re-render optimizations (e.g. `useCallback` wrapping of mutations) will pay off only for components on the narrow hooks.

## 6) Form & validation architecture

Validation runs in **three layers**. A bad record needs to fail all three:

| Layer | Where | Catches |
|---|---|---|
| **Form schema** (Zod) | `lib/validations.ts → recordFormSchema` | Field types, numeric bounds, required fields, status-evidence rules |
| **Domain validator** | `lib/domain/validation.ts → validateDomainRecord` | Commodity-field isolation (CROP can't have fishery/livestock fields, etc.), invariants — *currently defined but not yet wired into the form* |
| **DB constraints** | `migrations/008`, `011`, `013` | CHECK constraints; the last line of defense. `15` has the trigger for archived-terminal. |

Plus two cross-record checks that are app-only:

| Layer | Where | Catches |
|---|---|---|
| **Household allocation guard** | `lib/domain/allocation.ts → validateHouseholdCropAllocation` (run in agri-context mutations) | Active crop area across household ≤ `farming_area_hectares` (legacy / `farmer_asset_id IS NULL`) |
| **Asset allocation guard** | `lib/domain/allocation.ts → validateLandAssetAllocation` (run in agri-context mutations, after the household path) | Active crop area on a single LAND asset ≤ that asset's `area_hectares` (Phase A–D). Also enforces the linkage rules (planting-area only, owner among farmer_ids) so client-side errors match the DB trigger's message shape. |

Both validators return tagged unions: `{ ok: true } | { ok: false; kind: 'structure' } | { ok: false; kind: 'capacity'; proposedHa; remainingHa; ... }`. Phase Next §4 uses the `kind` discriminator to route capacity rejections to `allocation_overflow_attempt` activity logs while leaving structural rejections (missing household, owner mismatch, duplicate cycle) unlogged.

The DB-side trigger (`trg_validate_record_asset`, migration 017) backstops the linkage rules — capacity overflow is still app-only.

## 7) Default sorting rules

All user-facing lists default-sort **A→Z**, case-insensitive, ignoring leading/trailing spaces. Implemented via `lib/sort.ts` + context-level sorting in `lib/agri-context.tsx`:

- **Barangays**: A→Z in dropdowns/pickers.
- **Households**: `display_name` A→Z, fallback to `id` when blank.
- **Organizations / Cooperatives / Associations**: `name` A→Z.
- **Farmers / Members**: last-name-first sorting using a heuristic:
  - last name = last token of `farmers.name`
  - full name is the tie-breaker
  - helpers live in `lib/name.ts`

## 8) Programs module

- **Programs view**: `components/dashboard/ProgramsView.tsx`
  - **Households list**: paginated (per-page selector + page controls)
  - **Organizations list**: paginated (per-page selector + page controls)
  - Member counts are clickable to open the members dialog.

### 8.1 Organization members "where is it now"

- **Members dialog**: `components/dashboard/OrganizationMembersDialog.tsx`
  - Lists members sorted A→Z (last-name-first).
  - Shows current barangay, household (via `getHousehold(farmer.household_id)`), and household-head status.
  - Clicking a member deep-links to the farmer detail view.

## 9) Farmers module

- **Registry**: `components/dashboard/FarmerRegistry.tsx`
  - Supports deep-link open using URL params:
    - `farmerId` → opens that farmer profile
    - `orgId` → shows context "Opened from organization …"
  - Displays names in a **stacked** layout: lastname on top, first+middle below.

## 10) Destructive actions (safety)

- **Confirmation dialog**: `components/ui/ConfirmDialog.tsx`
  - Cancel is default-focused.
  - Danger styling on destructive actions.
  - Optional **type-to-confirm** (trimmed, case-insensitive match).

Used by: delete organization (type org name), delete household (type display name), delete subsidy line item, delete asset line item.

## 11) Reporting & export pipeline

```mermaid
flowchart LR
  metricsCtx["useMetrics()<br/>+ raw hooks"] --> kpis["KpiCards / Charts<br/>(dashboard)"]
  agri["agri-context<br/>(orchestrator)"] --> exportBtn["ExportButton<br/>(CSV)"]
  agri --> docx["lib/export-docx.ts<br/>(DOCX)"]
  agri --> print["lib/print-report.ts<br/>(HTML print view)"]

  print -- "uses every getXMetrics" --> metrics["lib/domain/metrics.ts"]
  docx -. partially migrated to .-> metrics
  kpis --> metrics
  metricsCtx --> metrics
```

- **Print report** (`lib/print-report.ts`): per-period HTML with KPI strip, production analytics split by group, damage & risk analysis, risk ranking, barangay summary, capacity utilization, and per-barangay sections. Fully Phase 4-aligned.
- **DOCX export** (`lib/export-docx.ts`): still has some inline reducers alongside metrics calls — partial migration.
- **CSV export — records** (`components/dashboard/ExportButton.tsx`): uses `productionOutputForRecord()` from `lib/data.ts` for per-row export.
- **CSV export — activity logs** (`lib/export-activity-csv.ts`, Phase Next): triggered from the User Activity panel. Walks the cursor pagination in 500-row pages until exhausted or a 10,000-row safety cap is hit, then builds an RFC-4180 CSV with a UTF-8 BOM (Excel-friendly) and triggers a browser blob download. JSON columns (`before` / `after` / `metadata`) are stringified compactly. RLS still applies — barangay users implicitly export only their barangay's rows.
- **Dashboard KPIs**: Phase G migrated `KpiCards` to `useMetrics()` + narrow hooks. Other dashboard components still use `useAgriData()` and can be migrated incrementally.

All four callers respect the lifecycle rules: `active` rows never appear in finalized-production sums.

## 12) Runtime flow overview

```mermaid
flowchart TD
  user[User] --> page[app/page.tsx]
  page --> views[Dashboard views]

  page --> auth[lib/auth-context.tsx]
  auth --> agri["lib/agri-context.tsx<br/>(orchestrator)"]
  agri --> farmersCtx["FarmersContext"]
  agri --> programsCtx["ProgramsContext"]
  agri --> recordsCtx["RecordsContext"]
  agri --> metricsCtx["MetricsContext"]
  agri --> domain[lib/domain/*]
  agri --> sb[lib/supabase/*]
  sb --> supabase[("Supabase<br/>Postgres + RLS")]

  views --> kpi["KpiCards<br/>(useMetrics)"]
  views --> records[RecordsView]
  views --> programs[ProgramsView]
  views --> farmers[FarmerRegistry]
  views --> damage[DamageRiskMonitoring]

  kpi -.subscribes.-> metricsCtx
  kpi -.subscribes.-> recordsCtx
  kpi -.subscribes.-> farmersCtx
  kpi -.subscribes.-> programsCtx

  records --> recordForm[RecordFormDialog]
  recordForm --> formSchema[recordFormSchema<br/>lib/validations.ts]
  recordForm --> domainStatus[domain/status.ts<br/>canTransition]

  damage --> domain

  programs --> membersDialog[OrganizationMembersDialog]
  membersDialog -->|"pushState"| page

  programs --> confirm[ConfirmDialog]
  farmers --> confirm
  records --> confirm
```

## 13) Phase evolution

| Phase | Theme | Major additions |
|---|---|---|
| **0** | Foundation | Tables, RLS, auth + profiles, lifecycle_status (legacy column), farmer assets |
| **1** | Domain Model Stabilization | `commodity_group`, new `status`, fishery_loss_pieces, livestock_*_heads, validation parity (`lib/domain/{commodity,commodityRules,status}.ts`) |
| **2** | Validation + Enforcement | `lib/domain/{lifecycle,metrics,validation,units,severity,invariants,audit,allocation,utilization}.ts`, DB CHECK constraints (013) + archived trigger (015) |
| **3** | Commodity-Aware UI | Status dropdown replaces legacy lifecycle dropdown, transition guards in form, status badges, conditional commodity field sections |
| **4** | Reporting Stabilization | Centralized aggregators with `traceAggregation` wrapping, severity classifiers, risk ranking, capacity tile, lifecycle tile, print report rewrite |
| **5** | Provider refactor + security | Split `AgriDataProvider` into 4 contexts (Farmers/Programs/Records/Metrics) with thin domain context files; extracted helpers (`normalize.ts`, `insert-rows.ts`, `supabase/errors.ts`); RLS enabled on `agri_records` (migration 016); `agri-context.tsx` shrunk from 1209 → 766 lines (−37%) |
| **A–D** | Land Asset Allocation | LAND (planting-area) assets become operational allocation sources. Migration 017 adds `agri_records.farmer_asset_id` (nullable FK), a linkage trigger, a `v_land_asset_allocation` view, an `fn_remaining_land_ha` RPC, and reserves GIS-ready columns on `farmer_assets`. Migration 018 reconciles a diverged `farmer_assets` schema. App layer gains `validateLandAssetAllocation` (parallel to the household path), a Land tab with per-lot utilisation, an asset selector in the record form, and a backfill script (`scripts/backfill-land-asset.ts`) for historical rows. Phase E (PostGIS swap, map UI) deliberately deferred. |
| **Next** | Activity Timeline & Operational History | Append-only `public.activity_logs` (migration 019) records who did what, when. App-side logging from `agri-context.tsx` covers 24+ mutation sites across 7 entity tables; payload is a compact field diff (~200 bytes typical) plus a pre-rendered summary. `lib/domain/activity.ts` (pure: diff/summary/resolver helpers) + `lib/activity-log.ts` (fail-soft writer) + `lib/contexts/activity-context.tsx` (lazy read hooks). UI: per-record Timeline tab in `RecordFormDialog` + admin-only Activity tab in the dashboard shell + CSV export via `lib/export-activity-csv.ts`. Capacity-overflow rejections become `allocation_overflow_attempt` rows. Logs are immutable (no UPDATE/DELETE policies). DB-trigger safety net deliberately deferred; schema reserves room. |

### Phase 5 sub-steps (provider refactor)

| Step | Done | Result |
|---|---|---|
| A | ✅ | `MetricsProvider` extracted (22 derived memos) |
| B | ✅ | `ProgramsProvider` context (households + orgs + subsidies) |
| C | ✅ | `FarmersProvider` context (farmers + assets + farmer_orgs) |
| D | ✅ | `RecordsProvider` context (agri_records + 3 mutations) |
| E | ✅ | `MetricsProvider` flipped to hook-fed (no more prop drilling) |
| F-lite | ✅ | Helpers extracted to dedicated files |
| G | ✅ | `KpiCards` migrated as reference example |
| H | ⏸️ skipped | `useAgriData()` facade kept for back-compat |

### Phase A–D sub-steps (Land Asset Allocation)

| Step | Done | Result |
|---|---|---|
| A — Schema | ✅ | Migration 017: `agri_records.farmer_asset_id` (nullable FK), `trg_validate_record_asset` trigger, `v_land_asset_allocation` view, `fn_remaining_land_ha` RPC, GIS-ready columns reserved on `farmer_assets` (`parcel_label`, `parcel_code`, `geom_geojson`, `centroid_lat/_lng`). Migration 018 reconciles `farmer_assets` (diverged shape from out-of-band bootstrap). |
| B — Dual-mode domain | ✅ | `validateLandAssetAllocation` + helpers in `lib/domain/allocation.ts`; threaded `farmer_asset_id` through `data.ts`, `normalize.ts`, `insert-rows.ts`, `agri-context.tsx`; `farmerAssetsRef` added; the new validator runs in parallel with `validateHouseholdCropAllocation` at insert and update. |
| C — UI | ✅ | Optional asset selector in `RecordFormDialog` (CROP-only, with live "Remaining: X ha" hint that excludes own contribution on edits); new `LandAllocation` panel + sidebar tab; `FarmerAssetsDialog` requires `parcel_label` and `area_hectares > 0` for planting-area assets. |
| D — Tighten | ✅ | Asset selector becomes **required** for new CROP records when the farmer has any eligible planting-area asset on file (edits of legacy rows stay open). Backfill script (`scripts/backfill-land-asset.ts`) picks the candidate with the most remaining capacity, dry-run by default; pass `--apply` to write. |
| E — GIS | ⏸️ deferred | Reserved columns store GeoJSON in JSONB and lat/lng centroids today. A later migration would enable PostGIS, swap to `geography(MultiPolygon, 4326)`, backfill via `ST_GeomFromGeoJSON`, and add a map UI. No code committed for this step. |

### Phase Next sub-steps (Activity Timeline)

| Step | Done | Result |
|---|---|---|
| 1 — Schema + helper + agri_records | ✅ | Migration 019 (table, three indexes, append-only RLS). `lib/data.ts` types + `lib/domain/activity.ts` (pure) + `lib/activity-log.ts` (fail-soft writer). `normalize.ts` + `insert-rows.ts` plumbing. `addRecord` / `updateRecord` / `deleteRecord` in `agri-context.tsx` emit logs. Logs accumulate silently; no UI yet. |
| 2 — Timeline UI | ✅ | `lib/contexts/activity-context.tsx` ships `useActivityLog(entityType, entityId)` — bare hook, no Provider. `components/dashboard/RecordTimeline.tsx` + a new Details/Timeline pill strip in `RecordFormDialog`. Day-grouped, action-colored, cursor-paginated 20/page. Fetch only fires on tab open. |
| 3 — Extend to other entities | ✅ | 16 more mutation sites wired (farmers / households / farmer_assets / organizations / household_subsidies / farmer_organizations). Six new entity summary builders in `activity.ts`. Cascade-effect counts captured in `metadata.cascade` on parent delete (avoids per-row log explosions). `host barangay = 'ALL'` sentinel for cross-barangay orgs. |
| 4 — Allocation-overflow attempts | ✅ | Allocation validators upgraded to discriminated unions (`kind: 'capacity' \| 'structure'`). Capacity rejections in `addRecord`/`updateRecord` emit `allocation_overflow_attempt` rows carrying `proposed_ha`, `remaining_ha`, pool identity. Structural rejections stay unlogged. |
| 5 — Exports & investigation views | ✅ | `useActivityFeed(filter)` in the same context file. `lib/export-activity-csv.ts` (RFC-4180, UTF-8 BOM, 10,000-row cap). `components/dashboard/UserActivityPanel.tsx` — filters + paginated table + Export CSV. Mounted as an admin-only "Activity" tab in `app/page.tsx`. |
| 6 — DB-trigger safety net | ⏸️ deferred | Schema reserves `source = 'db_trigger'` for a future BEFORE INSERT/UPDATE/DELETE trigger pack that would catch direct service-role SQL writes. Today's surface is fully covered by the app-side path; deferred to avoid trigger-bug risk vs. marginal coverage gain. |

## 14) Key files (index)

### Application root
- `app/page.tsx` — dashboard shell, tab routing, deep-link support
- `app/layout.tsx` — providers (Auth, AgriData), global styles
- `middleware.ts` — Next middleware that delegates to `lib/supabase/middleware.ts`

### Context
- `lib/auth-context.tsx` — Supabase auth wrapper, role + barangay
- `lib/agri-context.tsx` — **orchestrator**: table loader, visible slices, mutations, provider composition, `useAgriData()` facade
- `lib/contexts/farmers-context.tsx` — `FarmersContext` + `useFarmers()` (farmers + assets + farmer_orgs)
- `lib/contexts/programs-context.tsx` — `ProgramsContext` + `usePrograms()` (households + orgs + subsidies)
- `lib/contexts/records-context.tsx` — `RecordsContext` + `useRecords()` (agri_records + record mutations)
- `lib/contexts/metrics-context.tsx` — `MetricsContext` + `useMetrics()` (22 derived summaries; hook-fed via Phase E)
- `lib/contexts/activity-context.tsx` — **Phase Next**: bare hooks `useActivityLog` (per-entity) + `useActivityFeed` (filterable). No Provider — lazy fetch only when consumed.

### Domain (Phase 1–4 + Phase A + Phase Next)
- `lib/domain/index.ts` — barrel
- `lib/domain/commodity.ts`, `commodityRules.ts` — group mapping + per-group rules
- `lib/domain/status.ts` — `RecordStatus` enum, labels, transitions
- `lib/domain/lifecycle.ts` — status predicates, evidence rules, transition table
- `lib/domain/metrics.ts` — all aggregators (traceAggregation-wrapped)
- `lib/domain/utilization.ts` — capacity helpers
- `lib/domain/allocation.ts` — household + asset capacity validators (tagged-union results)
- `lib/domain/severity.ts` — per-group damage classifiers
- `lib/domain/validation.ts` — domain validator (zod + invariants)
- `lib/domain/invariants.ts` — reporting integrity rules
- `lib/domain/audit.ts` — `traceAggregation`, `WithMeta`
- `lib/domain/units.ts` — `Unit` + crop bags ↔ MT (the only converter)
- `lib/domain/activity.ts` — **Phase Next**: diff helpers, action resolvers, summary builders, logged-field lists

### Data access
- `lib/supabase/env.ts` · `client.ts` · `server.ts` · `middleware.ts`
- `lib/supabase/errors.ts` — `friendlyDbError()` (Phase F-lite extraction)
- `lib/data.ts` — `AgriRecord` / `Farmer` / `Household` types, `COMMODITY_COLORS`, `LIFECYCLE_STATUSES`
- `lib/normalize.ts` — Supabase-row → TS-type normalizers (Phase F-lite extraction)
- `lib/insert-rows.ts` — TS-type → Supabase column shape builders (Phase F-lite extraction)
- `lib/validations.ts` — `recordFormSchema` (Zod)

### Reports
- `lib/print-report.ts` — HTML print view
- `lib/export-docx.ts` — DOCX export
- `components/dashboard/ExportButton.tsx` — CSV export (records)
- `lib/export-activity-csv.ts` — CSV export (activity logs; Phase Next §5)
- `lib/activity-log.ts` — `logActivity()` fail-soft writer (Phase Next §1)

### UI utilities
- `lib/sort.ts` — A→Z compare helpers
- `lib/name.ts` — last-name heuristic + display utilities

### Dashboard views
- `components/dashboard/KpiCards.tsx` — 7-tile KPI strip
- `components/dashboard/DataTable.tsx` — records list with status chips
- `components/dashboard/CommodityAnalytics.tsx`
- `components/dashboard/DamageRiskMonitoring.tsx`
- `components/dashboard/ProgramsView.tsx`
- `components/dashboard/OrganizationMembersDialog.tsx`
- `components/dashboard/FarmerRegistry.tsx`
- `components/dashboard/FarmerDistribution.tsx`
- `components/dashboard/SubCategoryAnalytics.tsx`
- `components/dashboard/FindingMatrix.tsx`
- `components/dashboard/DailySummaryCalendar.tsx`
- `components/dashboard/LandAllocation.tsx` — per-lot allocation panel (Phase C)
- `components/dashboard/UserActivityPanel.tsx` — cross-cutting audit feed + CSV export (Phase Next §5)
- `components/dashboard/RecordTimeline.tsx` — per-record history panel mounted inside `RecordFormDialog` (Phase Next §2)

### Dialogs
- `components/dashboard/RecordFormDialog.tsx`
- `components/dashboard/record-form/{StatusBadge,CropFields,FisheryFields,LivestockFields,Field}.tsx`
- `components/dashboard/FarmerFormDialog.tsx`
- `components/dashboard/HouseholdBrowseDialog.tsx`
- `components/dashboard/HouseholdEditDialog.tsx`
- `components/dashboard/FarmerSelectDialog.tsx`
- `components/ui/ConfirmDialog.tsx`
- `components/ui/DialogPortal.tsx`

### Tests & scripts
- `scripts/test-metrics.ts` — Phase 4 smoke tests (54 cases, all passing)
- `scripts/seed-supabase-bulk.ts` — bulk seed for dev
- `scripts/backfill-land-asset.ts` — Phase D backfill for `agri_records.farmer_asset_id` (dry-run default, `--apply` to write)

## 15) Where to look next

| If you want to … | Read |
|---|---|
| Understand the DB connection, RLS, schema | `Database Architecture.md` |
| Read the canonical domain spec | `Phase 1 Domain Model.md` |
| Understand land asset allocation end-to-end | `Phase A Land Asset Allocation.md` |
| Understand the activity / operational history subsystem | `Phase Next Activity Timeline.md` |
| Trace a metric back to source | `lib/domain/metrics.ts` + `scripts/test-metrics.ts` |
| Add a new record type | start with `lib/data.ts:AgriRecord`, then `commodity.ts`, then `RecordFormDialog` |
| Tighten validation | `lib/validations.ts` (form) + `lib/domain/validation.ts` (domain) + a migration in `migrations/` |
| Migrate a component off `useAgriData()` | See KpiCards (`components/dashboard/KpiCards.tsx`) as reference — declare narrow hook deps |
| Add a new context slice | `lib/contexts/*-context.tsx` for the type/provider/hook + bundle the value object in `agri-context.tsx` |

## 16) Known follow-ups (not yet done)

1. **`useCallback` wrap on mutations** — currently mutations re-create per render, so the per-provider `value` objects also re-create. Wrapping mutations in `useCallback` would let the value memos stabilize and finally deliver true re-render isolation across narrow hook subscribers.
2. **Full state separation (true Phase F)** — moving state ownership into each provider file would slim `agri-context.tsx` to ~30 lines. Requires resolving cross-cutting mutations (`deleteFarmer` etc.) via shared refs or callback wiring. Estimated 6–10 hours; deferred until clearly needed.
3. **More component migrations off `useAgriData()`** — `CommodityAnalytics`, `DamageRiskMonitoring`, `DataTable`, `ProgramsView`, `FarmerRegistry` still use the facade. KpiCards is the only migrated component.
4. **`validateDomainRecord` is dormant** — defined in `lib/domain/validation.ts` but not yet wired into the form. The form still uses `recordFormSchema` from `lib/validations.ts` for client validation.
5. **DOCX export partial migration** — `lib/export-docx.ts` still has some inline reducers alongside metrics calls.
6. **`profiles_update_own` escalation vector** — see `Database Architecture.md` §11; latent privilege escalation if a BARANGAY_USER updates their own role/barangay.
7. **Phase E — PostGIS swap + map UI** — `farmer_assets` already reserves `geom_geojson` (JSONB) + `centroid_lat/lng`. When real spatial queries are needed: enable PostGIS, swap to `geography(MultiPolygon,4326)`, backfill via `ST_GeomFromGeoJSON`, then add `ST_Intersects` to detect true overlap and a `react-leaflet`-based map panel. No code yet.
8. **`scripts/schema.sql` is incomplete** — bootstrapped only `farmers`/`households`/`agri_records`; missing `farmer_assets`, household_subsidies, commodity_group, Phase 2 `status`, and `agri_records` RLS. Anyone running it gets a DB that needs migrations 002–019 applied separately. Migration 018 documents and reconciles the diverged `farmer_assets` shape that this gap produced in one environment.
9. **Activity-log DB-trigger safety net (Phase Next §6)** — deliberately not built. App-side covers all 24+ mutation sites today; the only remaining surface is direct service-role SQL writes (seed loads, retention pruning, admin one-offs), and logging those would clutter the audit table with maintenance noise. If automated server-side writes become routine, add a trigger pack tagged `source = 'db_trigger'` — schema already reserves room.
10. **Activity-log retention pruning is manual** — `activity_logs` grows forever today. No auto-prune; documented manual cleanup query in migration 019's footer. If table size becomes a concern (year 3+), introduce a partition-by-month strategy without changing the API surface.
