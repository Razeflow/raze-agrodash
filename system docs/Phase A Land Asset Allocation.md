# Phase A — Land Asset Allocation

This document defines **Phase A** of the architecture evolution for **Raze AgroDash**. The goal is to turn LAND assets (rows in `farmer_assets` with `category='planting_area'`) from passive metadata into **operational allocation sources** for agricultural production cycles — without a destructive rewrite, without breaking legacy records, and without committing to PostGIS yet.

Phase A is delivered as four sub-steps (B through D, with A being the schema layer). Phase E (PostGIS + map UI) is intentionally deferred.

## Goals (Phase A only)

- Make `agri_records` reference a specific LAND lot via `farmer_asset_id`.
- Allow per-lot capacity tracking alongside the existing household-level pool.
- Prevent overlap and over-allocation on a single lot.
- Release allocation automatically when a record reaches a terminal lifecycle status.
- Stay GIS-ready without enabling PostGIS today.
- Keep the existing household-pool path working unchanged for legacy rows.

**Non-goals**: PostGIS, true polygon overlap, map rendering, AI/forecasting. All deferred to Phase E.

## 1) Dual-mode allocation

A CROP `agri_records` row is allocated against **exactly one** of two capacity sources, decided per row:

| Mode | Selected when | Capacity source | Sum constraint |
|---|---|---|---|
| **Household pool** (legacy) | `farmer_asset_id IS NULL` | `households.farming_area_hectares` for the household resolved via `farmer_ids → farmers.household_id` | Σ active CROP `planting_area_hectares` over that household ≤ ceiling |
| **LAND asset** (Phase A) | `farmer_asset_id` set | `farmer_assets.area_hectares` for that single planting-area row | Σ active CROP `planting_area_hectares` pointing at the same asset ≤ that asset's area |

Both validators run in parallel for every record (`validateHouseholdCropAllocation` then `validateLandAssetAllocation` in `lib/agri-context.tsx`). The asset validator is a no-op when `farmer_asset_id` is null, so legacy rows keep working untouched.

Fishery and livestock records skip allocation entirely (no hectare-based capacity).

## 2) The asset linkage

A record may only point at an asset that satisfies all of:

1. `farmer_assets.category = 'planting_area'`.
2. `farmer_assets.farmer_id` appears in `agri_records.farmer_ids` (the owning farmer must be on the record).
3. `farmer_assets.area_hectares > 0`.

Rules 1 and 2 are enforced by the DB trigger `trg_validate_record_asset` (migration 017). Rule 3 is enforced at the app layer in `validateLandAssetAllocation` and in the form (the asset selector filters out zero-area lots).

Multi-farmer records are supported: any number of co-cultivators may appear in `farmer_ids`, but exactly **one** of them owns the lot. The record's allocation is attributed to that lot regardless of how many farmers share the cycle.

## 3) Lifecycle interaction

The asset path is bound to the **canonical** Phase 2 status (`active` / `harvested` / `damaged` / `archived`), not the legacy `lifecycle_status`. The rule is one line:

> A record consumes asset capacity iff `status = 'active'`.

| Status | Consumes asset area? | Notes |
|---|---|---|
| `active` | ✅ | Sum contributes to `utilized_ha`. |
| `harvested` | ❌ | Released. The harvested area can be re-allocated immediately. |
| `damaged` | ❌ | Released. Partial damage during the active phase is reported via `damage_pests_hectares` / `damage_calamity_hectares` on the still-active record. |
| `archived` | ❌ | Released. Terminal — guarded by `agri_records_archived_terminal_trg` (migration 015). |

No status transitions are added in Phase A. The four existing transitions (`active→harvested`, `active→damaged`, `harvested→archived`, `damaged→archived`) carry the release behaviour by being filtered out of the sum.

## 4) Schema additions (migration 017)

```
agri_records
  + farmer_asset_id UUID NULL
      REFERENCES farmer_assets(id) ON DELETE SET NULL
  + INDEX idx_agri_records_farmer_asset_id_active
      (farmer_asset_id, status) WHERE farmer_asset_id IS NOT NULL

farmer_assets
  + parcel_label TEXT          -- "Farm Lot A"
  + parcel_code  TEXT          -- optional cadastral / RSBSA ID
  + geom_geojson JSONB         -- reserved for Phase E (PostGIS swap)
  + centroid_lat DOUBLE PRECISION
  + centroid_lng DOUBLE PRECISION
```

Plus:

- **Trigger** `trg_validate_record_asset` — `BEFORE INSERT OR UPDATE OF farmer_asset_id, farmer_ids ON agri_records`. Enforces the linkage rules (planting-area category + owner present in `farmer_ids`). Runs `SECURITY INVOKER` so RLS still gates which assets a user can link.
- **View** `v_land_asset_allocation` — per-asset snapshot of `total_ha`, `utilized_ha`, `remaining_ha`, `active_record_count`. Created with `WITH (security_invoker = true)` so RLS on the underlying tables applies to view reads.
- **RPC** `fn_remaining_land_ha(p_asset_id, p_exclude_record_id)` — drives the form's live "Remaining: X ha" hint. The exclude argument is critical for edit mode so the record's own in-flight allocation isn't subtracted from itself.

Migration 017 is **idempotent** (all `IF NOT EXISTS` / `CREATE OR REPLACE` / drop-then-create), and section 3 also adds `area_hectares` defensively in case 007 was applied incompletely.

## 5) Reconciliation migration (018)

One environment was bootstrapped via `scripts/full-setup.sql` plus an out-of-band `CREATE TABLE` that produced a `farmer_assets` shape diverged from migration 007 (`asset_type` instead of `category`, `size_or_quantity` instead of `quantity` + `area_hectares`, plus extra `name`/`location` columns). The app code in `lib/contexts/farmers-context.tsx` was already reading the canonical names, so the feature was silently broken there.

Migration 018 drops `farmer_assets` with `CASCADE` (verified 0 rows before running) and recreates it in the canonical shape, including the GIS-ready columns from 017. It's a one-time reset, not a routine migration. It exists so the recovery path is documented and reproducible — re-applying it would erase data, so it should not be run on environments that have moved past the diverged state.

After 018, re-run 017 to re-add `agri_records.farmer_asset_id` (which the CASCADE drops along with the FK).

## 6) Validation layers

| Layer | Where | Catches |
|---|---|---|
| **Zod form schema** | `lib/validations.ts` | `farmer_asset_id` shape (uuid \| null \| undefined). |
| **Form-level requirement** | `RecordFormDialog.validate()` | Required for *new* CROP records when the farmer has at least one eligible planting-area asset on file. Edits of legacy rows are not gated. |
| **Domain validator** | `lib/domain/allocation.ts → validateLandAssetAllocation` | Linkage rules (planting-area only, owner present), capacity overflow (asset's `area_hectares` minus active sum). |
| **DB trigger** | `trg_validate_record_asset` (migration 017) | Linkage rules (defense-in-depth against direct SQL inserts). |

Capacity overflow is **not** enforced at the DB layer — direct SQL inserts can still overflow. App-only, like the household path.

## 7) Backward compatibility strategy

Phase A is additive. Specifically:

- `agri_records.farmer_asset_id` is **nullable**. Every existing row stays NULL until either (a) a user edits it through the dialog and picks a lot, or (b) the backfill script `scripts/backfill-land-asset.ts` assigns one.
- The household-pool validator (`validateHouseholdCropAllocation`) is **unchanged**. Legacy rows continue to be checked against `households.farming_area_hectares`.
- The legacy `lifecycle_status` column is **unchanged**. The Phase 2 `status` column drives Phase A allocation rules.
- Phase D's "required" rule is **scoped to NEW records**. Existing rows can still be edited without picking a lot, so the rollout doesn't block ongoing work.
- The backfill script is **dry-run by default** and only fills rows where `farmer_asset_id IS NULL`. It's safe to re-run.

## 8) Reporting & aggregation

No metric function changes shape. Production / damage / capacity aggregators still operate on `agri_records` regardless of `farmer_asset_id`. What Phase A adds is a new *dimension* — every harvested record now optionally carries a lot identity, so future reports can break production down by lot without further schema work.

Today's reports (DOCX, print, CSV) do not yet read `farmer_asset_id`. The `LandAllocation` panel and the `v_land_asset_allocation` view are the two consumers in Phase A.

## 9) GIS-ready posture

Phase A deliberately stops short of PostGIS. The five reserved columns on `farmer_assets` are enough to:

- Store geometry as GeoJSON today (`geom_geojson` JSONB).
- Render a marker on a future map (`centroid_lat`, `centroid_lng`).
- Carry an external cadastral / RSBSA identifier (`parcel_code`).
- Give every record an automatic geographic footprint once a geometry is filled in — no schema change needed.

When real spatial queries are wanted (Phase E):

```
1. Install the postgis extension.
2. Add: geom geography(MultiPolygon, 4326)
3. Backfill: UPDATE farmer_assets SET geom = ST_GeomFromGeoJSON(geom_geojson::text)
4. Add a partial GIST index on geom WHERE geom IS NOT NULL.
5. Replace the in-memory overlap heuristic with ST_Intersects.
6. Add a react-leaflet (or mapbox) map panel.
```

Until then, the asset selector's sum check is the operational overlap prevention — two active records on the same lot whose hectares would exceed `area_hectares` are simply rejected.

## 10) Rollout order (Phase A)

The work shipped in four sub-steps, each independently shippable:

| Step | Theme | Major output |
|---|---|---|
| **A — Schema** | Migration 017 (+ reconciliation 018 if applicable) | `farmer_asset_id` column, trigger, view, RPC, GIS-ready columns |
| **B — Dual-mode domain** | `validateLandAssetAllocation` + plumbing through `data.ts`, `normalize.ts`, `insert-rows.ts`, `agri-context.tsx` (incl. `farmerAssetsRef`) | The new validator runs in parallel with the household path. No UI change. |
| **C — Optional UI** | Land asset selector in `RecordFormDialog`; `LandAllocation` panel + sidebar tab; `FarmerAssetsDialog` requires `parcel_label` + `area_hectares > 0` for planting-area | Selector is optional; users can adopt incrementally. |
| **D — Tighten** | Selector becomes required for new CROP records when an eligible asset exists; backfill script (`scripts/backfill-land-asset.ts`) for historical rows | Adoption is driven; legacy edits stay open. Backfill picks the candidate with most remaining capacity, skips overflows. |

Stop points are real: A + B alone is correct but dormant. A + B + C is fully functional and optional. A + B + C + D is fully on with a documented backfill path.

## 11) Where to look next

| If you want to … | Read |
|---|---|
| See where the allocation validators sit | `lib/domain/allocation.ts` |
| Understand the form-level flow | `components/dashboard/RecordFormDialog.tsx` (search for `eligibleLandAssets`) |
| Read the per-lot panel | `components/dashboard/LandAllocation.tsx` |
| Trace the SQL surface | `migrations/017_land_allocation.sql` + `migrations/018_farmer_assets_reset.sql` |
| Run the backfill | `npx tsx scripts/backfill-land-asset.ts` (dry-run) → `--apply` to write |
| Understand the wider system | `System Architecture.md` (§3.4, §6) and `Database Architecture.md` (§6, §8) |
