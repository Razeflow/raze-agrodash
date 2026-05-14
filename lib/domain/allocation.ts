import type { AgriRecord, Farmer, FarmerAsset, Household } from "@/lib/data";
import { numField } from "@/lib/data";
import { commodityGroupForCommodity } from "./commodity";
import { recordStatus, type RecordLike } from "./metrics";

const FP_EPS = 1e-6;

/** Hectares this row consumes toward household planting capacity (crop cycles only). */
export function cropActiveAllocationHa(r: RecordLike): number {
  if (commodityGroupForCommodity(r.commodity) !== "CROP") return 0;
  if (recordStatus(r) !== "active") return 0;
  return Math.max(0, numField(r.planting_area_hectares));
}

/**
 * After finalize (harvested/damaged/archived), the cycle no longer consumes household capacity.
 * Partial physical occupancy can be modeled later via `released_allocation_ha`; for now release is full.
 */
export function consumesHouseholdPlantingCapacity(r: RecordLike): boolean {
  return cropActiveAllocationHa(r) > FP_EPS;
}

export function resolveHouseholdFromFarmers(
  farmerIds: string[],
  farmers: Farmer[],
): { ok: true; householdId: string } | { ok: false; message: string } {
  const ids = farmerIds?.filter(Boolean) ?? [];
  if (ids.length === 0) {
    return { ok: false, message: "Select at least one farmer to attribute this crop record to a household." };
  }
  const linked = farmers.filter((f) => ids.includes(f.id));
  if (linked.length !== ids.length) {
    return { ok: false, message: "Some selected farmers are missing from the registry—refresh and try again." };
  }
  const hhIds = linked.map((f) => f.household_id).filter((x): x is string => typeof x === "string" && x.length > 0);
  if (hhIds.length !== linked.length) {
    return {
      ok: false,
      message: "Every selected farmer must belong to a household for area allocation. Link farmers to a household first.",
    };
  }
  const unique = new Set(hhIds);
  if (unique.size !== 1) {
    return { ok: false, message: "All selected farmers must belong to the same household for crop area allocation." };
  }
  return { ok: true, householdId: hhIds[0]! };
}

export function householdIdForRecord(r: RecordLike, farmers: Farmer[]): string | null {
  const res = resolveHouseholdFromFarmers(r.farmer_ids || [], farmers);
  return res.ok ? res.householdId : null;
}

/**
 * Sum of active crop `planting_area_hectares` for records attributed to this household.
 */
export function sumHouseholdActiveCropAllocationHa(
  householdId: string,
  records: RecordLike[],
  farmers: Farmer[],
  opts?: { excludeRecordId?: string },
): number {
  let sum = 0;
  for (const r of records) {
    if (opts?.excludeRecordId && r.id === opts.excludeRecordId) continue;
    const hid = householdIdForRecord(r, farmers);
    if (hid !== householdId) continue;
    sum += cropActiveAllocationHa(r);
  }
  return sum;
}

export function calculateRemainingHouseholdPlantingHa(
  household: Household,
  records: RecordLike[],
  farmers: Farmer[],
  opts?: { excludeRecordId?: string },
): number {
  const cap = Math.max(0, numField(household.farming_area_hectares));
  const used = sumHouseholdActiveCropAllocationHa(household.id, records, farmers, opts);
  return Math.max(0, +(cap - used).toFixed(6));
}

export function canAllocateCropActiveHa(input: {
  household: Household;
  records: RecordLike[];
  farmers: Farmer[];
  proposedActiveHa: number;
  excludeRecordId?: string;
}): { ok: true; remainingAfter: number } | { ok: false; message: string; remainingBefore: number } {
  const proposed = Math.max(0, numField(input.proposedActiveHa));
  const remainingBefore = calculateRemainingHouseholdPlantingHa(input.household, input.records, input.farmers, {
    excludeRecordId: input.excludeRecordId,
  });
  if (proposed > remainingBefore + FP_EPS) {
    return {
      ok: false,
      message: `Active planted area (${proposed.toFixed(2)} ha) exceeds remaining household capacity (${remainingBefore.toFixed(2)} ha). Reduce area or finalize/release other active cycles.`,
      remainingBefore,
    };
  }
  return { ok: true, remainingAfter: +(remainingBefore - proposed).toFixed(6) };
}

/**
 * Prevent duplicate “same farmer × same reporting period × same crop identity” active cycles.
 * Operational proxy for overlap without GIS polygons.
 */
export function findConflictingActiveCropCycle(input: {
  farmerIds: string[];
  periodMonth: number | null;
  periodYear: number | null;
  commodity: AgriRecord["commodity"];
  subCategory: string;
  records: RecordLike[];
  excludeRecordId?: string;
}): RecordLike | undefined {
  if (input.periodMonth == null || input.periodYear == null) return undefined;
  const ids = new Set(input.farmerIds.filter(Boolean));
  if (ids.size === 0) return undefined;

  return input.records.find((r) => {
    if (input.excludeRecordId && r.id === input.excludeRecordId) return false;
    if (commodityGroupForCommodity(r.commodity) !== "CROP") return false;
    if (recordStatus(r) !== "active") return false;
    if (r.period_month !== input.periodMonth || r.period_year !== input.periodYear) return false;
    if (r.commodity !== input.commodity || r.sub_category !== input.subCategory) return false;
    const rf = new Set(r.farmer_ids || []);
    for (const id of ids) if (rf.has(id)) return true;
    return false;
  });
}

/**
 * Discriminator on validator failures:
 *   - 'capacity'  → the user tried to allocate more than the pool has left.
 *                   `proposedHa` / `remainingHa` are populated. Phase 4 logs
 *                   these as `allocation_overflow_attempt` activity rows.
 *   - 'structure' → a non-overflow reject (missing household, owner
 *                   mismatch, duplicate cycle, etc.). Not logged.
 */
export type AllocationRejectKind = "capacity" | "structure";

export type HouseholdAllocationValidation =
  | { ok: true }
  | { ok: false; message: string; kind: "structure" }
  | {
      ok: false;
      message: string;
      kind: "capacity";
      proposedHa: number;
      remainingHa: number;
      householdId: string;
    };

/**
 * Validates household planting capacity and duplicate active-cycle rules for crop rows.
 * Fishery/livestock records skip allocation (no ha capacity).
 */
export function validateHouseholdCropAllocation(input: {
  record: RecordLike;
  households: Household[];
  records: RecordLike[];
  farmers: Farmer[];
  excludeRecordId?: string;
}): HouseholdAllocationValidation {
  const r = input.record;
  if (commodityGroupForCommodity(r.commodity) !== "CROP") return { ok: true };

  const hhRes = resolveHouseholdFromFarmers(r.farmer_ids || [], input.farmers);
  if (!hhRes.ok) return { ok: false, message: hhRes.message, kind: "structure" };

  const household = input.households.find((h) => h.id === hhRes.householdId);
  if (!household) {
    return {
      ok: false,
      message: "Household not found for selected farmers—refresh and try again.",
      kind: "structure",
    };
  }

  const st = recordStatus(r);

  if (st === "active") {
    const proposedHa = numField(r.planting_area_hectares);
    const capAlloc = canAllocateCropActiveHa({
      household,
      records: input.records,
      farmers: input.farmers,
      proposedActiveHa: proposedHa,
      excludeRecordId: input.excludeRecordId,
    });
    if (!capAlloc.ok) {
      return {
        ok: false,
        message: capAlloc.message,
        kind: "capacity",
        proposedHa,
        remainingHa: capAlloc.remainingBefore,
        householdId: household.id,
      };
    }

    const conflict = findConflictingActiveCropCycle({
      farmerIds: r.farmer_ids || [],
      periodMonth: r.period_month,
      periodYear: r.period_year,
      commodity: r.commodity,
      subCategory: r.sub_category,
      records: input.records,
      excludeRecordId: input.excludeRecordId,
    });
    if (conflict) {
      return {
        ok: false,
        message:
          "An active crop cycle already exists for one of these farmers in this reporting period with the same commodity and variety. Finalize or archive it before starting another.",
        kind: "structure",
      };
    }
  }

  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Phase B — Asset-level (LAND) allocation
 *
 * Runs in parallel with the household path. A record opts in by setting
 * `farmer_asset_id`; when null, only the household path applies. When set,
 * both run — the asset path is narrower and catches the same overdraw that
 * the household path would, plus owner-mismatch and category errors.
 *
 * Mirrors the SQL trigger and view from migrations/017_land_allocation.sql:
 *   - asset must be category='planting_area'
 *   - asset's farmer_id must appear in record.farmer_ids
 *   - active CROP records consume planting_area_hectares against asset.area_hectares
 *   - harvested / damaged / archived records release allocation
 * ────────────────────────────────────────────────────────────────────── */

export type LandAssetAllocationValidation =
  | { ok: true }
  | {
      ok: false;
      message: string;
      kind: "structure";
      assetId?: string;
      parcelLabel?: string;
    }
  | {
      ok: false;
      message: string;
      kind: "capacity";
      proposedHa: number;
      remainingHa: number;
      totalHa: number;
      assetId: string;
      parcelLabel?: string;
    };

/**
 * Sum of active CROP `planting_area_hectares` for records pointing at a given asset.
 * Used by both `validateLandAssetAllocation` and the live-remaining hint in the form.
 */
export function sumActiveLandAssetAllocationHa(
  assetId: string,
  records: RecordLike[],
  opts?: { excludeRecordId?: string },
): number {
  let sum = 0;
  for (const r of records) {
    if (opts?.excludeRecordId && r.id === opts.excludeRecordId) continue;
    if (r.farmer_asset_id !== assetId) continue;
    if (commodityGroupForCommodity(r.commodity) !== "CROP") continue;
    if (recordStatus(r) !== "active") continue;
    sum += Math.max(0, numField(r.planting_area_hectares));
  }
  return sum;
}

/** Remaining capacity on a LAND asset, after subtracting active CROP records. */
export function calculateRemainingLandAssetHa(
  asset: FarmerAsset,
  records: RecordLike[],
  opts?: { excludeRecordId?: string },
): number {
  const total = Math.max(0, numField(asset.area_hectares));
  const used = sumActiveLandAssetAllocationHa(asset.id, records, opts);
  return Math.max(0, +(total - used).toFixed(6));
}

/**
 * Validates the asset linkage and asset-level capacity. No-op when the record
 * has no `farmer_asset_id`. Safe to call alongside `validateHouseholdCropAllocation`.
 */
export function validateLandAssetAllocation(input: {
  record: RecordLike;
  farmerAssets: FarmerAsset[];
  records: RecordLike[];
  excludeRecordId?: string;
}): LandAssetAllocationValidation {
  const r = input.record;
  const assetId = r.farmer_asset_id;
  if (!assetId) return { ok: true };

  const asset = input.farmerAssets.find((a) => a.id === assetId);
  if (!asset) {
    return {
      ok: false,
      message: "Selected land asset was not found — refresh and try again.",
      kind: "structure",
      assetId,
    };
  }
  if (asset.category !== "planting_area") {
    return {
      ok: false,
      message: "Only LAND (planting area) assets can be selected as an allocation source.",
      kind: "structure",
      assetId,
    };
  }
  if (!r.farmer_ids?.includes(asset.farmer_id)) {
    return {
      ok: false,
      message: "The owner of the selected land must be listed among the farmers on this record.",
      kind: "structure",
      assetId,
    };
  }

  // Asset-level capacity only matters for active CROP records.
  if (commodityGroupForCommodity(r.commodity) !== "CROP") return { ok: true };
  if (recordStatus(r) !== "active") return { ok: true };

  const total = Math.max(0, numField(asset.area_hectares));
  if (total <= 0) {
    return {
      ok: false,
      message: "Selected land asset has no area set — open Farmer Assets and enter its hectares first.",
      kind: "structure",
      assetId,
      parcelLabel: asset.parcel_label ?? undefined,
    };
  }

  const proposed = Math.max(0, numField(r.planting_area_hectares));
  const usedByOthers = sumActiveLandAssetAllocationHa(assetId, input.records, {
    excludeRecordId: input.excludeRecordId,
  });
  const remaining = +(total - usedByOthers).toFixed(6);

  if (proposed > remaining + FP_EPS) {
    const label = asset.parcel_label?.trim() || `the selected land`;
    return {
      ok: false,
      message:
        `Active planted area (${proposed.toFixed(2)} ha) exceeds remaining capacity on ${label} ` +
        `(${remaining.toFixed(2)} ha of ${total.toFixed(2)} ha total). Reduce area, pick another asset, ` +
        `or finalize a competing active cycle on this land.`,
      kind: "capacity",
      proposedHa: proposed,
      remainingHa: remaining,
      totalHa: total,
      assetId,
      parcelLabel: asset.parcel_label ?? undefined,
    };
  }

  return { ok: true };
}
