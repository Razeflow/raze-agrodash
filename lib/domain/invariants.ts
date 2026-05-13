/**
 * Phase 4 reporting invariants.
 *
 * Each invariant has two flavors:
 * - `check*` returns a `{ ok, message? }` result and never throws — safe in prod hot paths.
 * - `assert*` calls the check, throws in dev (NEXT_PUBLIC_DEBUG_METRICS=1 or NODE_ENV=development),
 *   logs a console warning otherwise. Use these inside aggregators to catch regressions.
 *
 * The list is meant to be exhaustive for the integrity rules called out in the spec:
 *   - active records never count toward finalized production
 *   - fishery pieces never convert to MT
 *   - livestock heads never merge into crop totals
 *   - active allocations cannot exceed household capacity
 *   - damaged area cannot exceed active planted area
 */
import type { Farmer, Household } from "@/lib/data";
import { numField } from "@/lib/data";
import { sumHouseholdActiveCropAllocationHa } from "./allocation";
import { commodityGroupForCommodity, type CommodityGroup } from "./commodity";
import { recordStatus, type RecordLike } from "./metrics";
import type { Unit } from "./units";

export type InvariantResult = { ok: true } | { ok: false; message: string };

const FP_EPS = 1e-6;

function devEnabled(): boolean {
  try {
    if (typeof process === "undefined") return false;
    return (
      process.env.NEXT_PUBLIC_DEBUG_METRICS === "1" ||
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    );
  } catch {
    return false;
  }
}

function fail(message: string): InvariantResult {
  return { ok: false, message };
}

function reportFailure(label: string, message: string): void {
  if (devEnabled()) throw new Error(`[invariant ${label}] ${message}`);
  // eslint-disable-next-line no-console
  console.warn(`[invariant ${label}] ${message}`);
}

/**
 * INV-1: A list of measured quantities must all share the same unit before they
 * can be summed, charted on the same axis, or rendered in the same KPI tile.
 */
export function checkNoMixedUnits(items: ReadonlyArray<{ unit: Unit }>): InvariantResult {
  if (items.length === 0) return { ok: true };
  const first = items[0].unit;
  for (const it of items) {
    if (it.unit !== first) {
      return fail(`Mixed units: found "${first}" and "${it.unit}" in the same series.`);
    }
  }
  return { ok: true };
}
export function assertNoMixedUnits(items: ReadonlyArray<{ unit: Unit }>): void {
  const r = checkNoMixedUnits(items);
  if (!r.ok) reportFailure("no_mixed_units", r.message);
}

/**
 * INV-2: Active and archived records must never contribute to a finalized
 * production total. Pass the records used in the rollup; this re-counts and
 * compares against the totals you already produced.
 */
export function checkActiveExcludedFromProduction(
  records: RecordLike[],
  totals: { harvestedBags?: number; harvestedPieces?: number; outputHeads?: number },
): InvariantResult {
  const finalized = records.filter((r) => recordStatus(r) === "harvested");
  const harvestedBags = finalized.reduce((s, r) => s + (commodityGroupForCommodity(r.commodity) === "CROP" ? numField(r.harvesting_output_bags) : 0), 0);
  const harvestedPieces = finalized.reduce((s, r) => s + (commodityGroupForCommodity(r.commodity) === "FISHERY" ? numField(r.harvesting_fishery) : 0), 0);
  const outputHeads = finalized.reduce((s, r) => s + (commodityGroupForCommodity(r.commodity) === "LIVESTOCK" ? numField(r.livestock_output_heads) : 0), 0);

  if (totals.harvestedBags != null && Math.abs(totals.harvestedBags - harvestedBags) > FP_EPS) {
    return fail(`Crop bag total includes non-harvested rows (got ${totals.harvestedBags}, expected ${harvestedBags}).`);
  }
  if (totals.harvestedPieces != null && Math.abs(totals.harvestedPieces - harvestedPieces) > FP_EPS) {
    return fail(`Fishery piece total includes non-harvested rows (got ${totals.harvestedPieces}, expected ${harvestedPieces}).`);
  }
  if (totals.outputHeads != null && Math.abs(totals.outputHeads - outputHeads) > FP_EPS) {
    return fail(`Livestock head total includes non-harvested rows (got ${totals.outputHeads}, expected ${outputHeads}).`);
  }
  return { ok: true };
}
export function assertActiveExcludedFromProduction(
  records: RecordLike[],
  totals: { harvestedBags?: number; harvestedPieces?: number; outputHeads?: number },
): void {
  const r = checkActiveExcludedFromProduction(records, totals);
  if (!r.ok) reportFailure("active_excluded_from_production", r.message);
}

/**
 * INV-3: A finalized "harvested" row must have a positive output for its group.
 */
export function checkFinalizedProductionRowHasOutput(r: RecordLike): InvariantResult {
  if (recordStatus(r) !== "harvested") return { ok: true };
  const g = commodityGroupForCommodity(r.commodity);
  if (g === "CROP" && numField(r.harvesting_output_bags) <= 0) return fail("Harvested crop row has zero bags.");
  if (g === "FISHERY" && numField(r.harvesting_fishery) <= 0) return fail("Harvested fishery row has zero fish.");
  if (g === "LIVESTOCK" && numField(r.livestock_output_heads) <= 0) return fail("Harvested livestock row has zero heads.");
  return { ok: true };
}
export function assertFinalizedProductionRowHasOutput(r: RecordLike): void {
  const res = checkFinalizedProductionRowHasOutput(r);
  if (!res.ok) reportFailure("finalized_row_has_output", res.message);
}

/**
 * INV-4: For crop rows, total damage hectares cannot exceed the planted area.
 * Mirrors the Postgres CHECK constraint added in migration 008.
 */
export function checkDamageDoesNotExceedActiveArea(r: RecordLike): InvariantResult {
  if (commodityGroupForCommodity(r.commodity) !== "CROP") return { ok: true };
  const planted = numField(r.planting_area_hectares);
  const dmg = numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
  if (planted <= 0 && dmg <= 0) return { ok: true };
  if (dmg > planted + FP_EPS) {
    return fail(`Damage (${dmg.toFixed(2)} ha) exceeds planted area (${planted.toFixed(2)} ha) on record ${r.id}.`);
  }
  return { ok: true };
}
export function assertDamageDoesNotExceedActiveArea(r: RecordLike): void {
  const res = checkDamageDoesNotExceedActiveArea(r);
  if (!res.ok) reportFailure("damage_within_active_area", res.message);
}

/**
 * INV-5: Sum of active crop allocations attributed to a household must not
 * exceed that household's `farming_area_hectares` capacity.
 */
export function checkHouseholdCapacityNotExceeded(
  household: Household,
  records: RecordLike[],
  farmers: Farmer[],
): InvariantResult {
  const cap = Math.max(0, numField(household.farming_area_hectares));
  const used = sumHouseholdActiveCropAllocationHa(household.id, records, farmers);
  if (used > cap + FP_EPS) {
    return fail(`Household ${household.id} active allocation (${used.toFixed(2)} ha) exceeds capacity (${cap.toFixed(2)} ha).`);
  }
  return { ok: true };
}
export function assertHouseholdCapacityNotExceeded(
  household: Household,
  records: RecordLike[],
  farmers: Farmer[],
): void {
  const res = checkHouseholdCapacityNotExceeded(household, records, farmers);
  if (!res.ok) reportFailure("household_capacity", res.message);
}

/**
 * INV-6: Fishery quantities must never be expressed in MT. The repo only ships
 * a single converter, `cropBagsToMetricTons` — this guards the consumer side.
 */
export function checkFisheryNeverConvertedToMt(quantities: ReadonlyArray<{ unit: Unit; group?: CommodityGroup }>): InvariantResult {
  for (const q of quantities) {
    if (q.group === "FISHERY" && q.unit === "mt") {
      return fail("Fishery quantity reported in MT — fishery uses fish counts, not weight.");
    }
  }
  return { ok: true };
}
export function assertFisheryNeverConvertedToMt(quantities: ReadonlyArray<{ unit: Unit; group?: CommodityGroup }>): void {
  const r = checkFisheryNeverConvertedToMt(quantities);
  if (!r.ok) reportFailure("fishery_no_mt", r.message);
}

/** INV-7: Only crop bag totals may be converted to metric tons. */
export function checkCropOnlyConvertsToMt(q: { unit: Unit; group?: CommodityGroup }): InvariantResult {
  if (q.unit !== "mt") return { ok: true };
  if (q.group && q.group !== "CROP") return fail(`Only crop totals may be expressed in MT (got ${q.group}).`);
  return { ok: true };
}
export function assertCropOnlyConvertsToMt(q: { unit: Unit; group?: CommodityGroup }): void {
  const r = checkCropOnlyConvertsToMt(q);
  if (!r.ok) reportFailure("crop_only_mt", r.message);
}
