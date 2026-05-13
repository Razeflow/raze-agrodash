/**
 * Phase 4 capacity / utilization analytics.
 *
 * Capacity comes from `households.farming_area_hectares`; "active" allocations
 * are the sum of crop rows attributed to that household whose status is `active`.
 * Finalized rows (harvested / damaged / archived) release capacity in full.
 *
 * The Phase 4 spec mentions `planned_area`, `active_planted_area`, and
 * `released_available_area`. We expose these as derived selectors here — no
 * schema columns are required.
 */
import type { Farmer, Household } from "@/lib/data";
import { numField } from "@/lib/data";
import { sumHouseholdActiveCropAllocationHa } from "./allocation";
import type { RecordLike } from "./metrics";
import { commodityGroupForCommodity } from "./commodity";
import { recordStatus } from "./metrics";

const FP_EPS = 1e-6;

export type HouseholdUtilization = {
  householdId: string;
  capacityHa: number;
  activeHa: number;
  remainingHa: number;
  utilizationPct: number;
  overallocated: boolean;
};

export type BarangayUtilization = {
  barangay: string;
  capacityHa: number;
  activeHa: number;
  remainingHa: number;
  utilizationPct: number;
  households: number;
  overallocatedHouseholds: number;
};

export type MunicipalUtilization = {
  capacityHa: number;
  activeHa: number;
  remainingHa: number;
  utilizationPct: number;
  households: number;
  overallocatedHouseholds: number;
};

export function householdCapacityHa(h: Household): number {
  return Math.max(0, numField(h.farming_area_hectares));
}

/** Re-export of allocation's active sum so utilization stays the canonical lookup. */
export function householdActiveHa(householdId: string, records: RecordLike[], farmers: Farmer[]): number {
  return sumHouseholdActiveCropAllocationHa(householdId, records, farmers);
}

export function householdUtilization(
  household: Household,
  records: RecordLike[],
  farmers: Farmer[],
): HouseholdUtilization {
  const capacityHa = householdCapacityHa(household);
  const activeHa = householdActiveHa(household.id, records, farmers);
  const remainingHa = +(Math.max(0, capacityHa - activeHa)).toFixed(6);
  const utilizationPct = capacityHa > FP_EPS ? +((activeHa / capacityHa) * 100).toFixed(1) : 0;
  return {
    householdId: household.id,
    capacityHa: +capacityHa.toFixed(2),
    activeHa: +activeHa.toFixed(2),
    remainingHa: +remainingHa.toFixed(2),
    utilizationPct,
    overallocated: activeHa > capacityHa + FP_EPS,
  };
}

export function barangayUtilization(
  barangay: string,
  households: Household[],
  records: RecordLike[],
  farmers: Farmer[],
): BarangayUtilization {
  const inBarangay = households.filter((h) => h.barangay === barangay);
  const perHh = inBarangay.map((h) => householdUtilization(h, records, farmers));
  const capacityHa = perHh.reduce((s, u) => s + u.capacityHa, 0);
  const activeHa = perHh.reduce((s, u) => s + u.activeHa, 0);
  const remainingHa = perHh.reduce((s, u) => s + u.remainingHa, 0);
  const utilizationPct = capacityHa > FP_EPS ? +((activeHa / capacityHa) * 100).toFixed(1) : 0;
  return {
    barangay,
    capacityHa: +capacityHa.toFixed(2),
    activeHa: +activeHa.toFixed(2),
    remainingHa: +remainingHa.toFixed(2),
    utilizationPct,
    households: inBarangay.length,
    overallocatedHouseholds: perHh.filter((u) => u.overallocated).length,
  };
}

export function municipalUtilization(
  households: Household[],
  records: RecordLike[],
  farmers: Farmer[],
): MunicipalUtilization {
  const perHh = households.map((h) => householdUtilization(h, records, farmers));
  const capacityHa = perHh.reduce((s, u) => s + u.capacityHa, 0);
  const activeHa = perHh.reduce((s, u) => s + u.activeHa, 0);
  const remainingHa = perHh.reduce((s, u) => s + u.remainingHa, 0);
  const utilizationPct = capacityHa > FP_EPS ? +((activeHa / capacityHa) * 100).toFixed(1) : 0;
  return {
    capacityHa: +capacityHa.toFixed(2),
    activeHa: +activeHa.toFixed(2),
    remainingHa: +remainingHa.toFixed(2),
    utilizationPct,
    households: households.length,
    overallocatedHouseholds: perHh.filter((u) => u.overallocated).length,
  };
}

/**
 * Phase 4 derived "released area" selector — useful for trend reporting.
 * Returns the sum of `planting_area_hectares` for finalized/archived crop rows,
 * which conceptually have released their share of household capacity.
 */
export function releasedCropAreaHa(records: RecordLike[]): number {
  let s = 0;
  for (const r of records) {
    if (commodityGroupForCommodity(r.commodity) !== "CROP") continue;
    const st = recordStatus(r);
    if (st === "harvested" || st === "damaged" || st === "archived") {
      s += numField(r.planting_area_hectares);
    }
  }
  return +s.toFixed(2);
}
