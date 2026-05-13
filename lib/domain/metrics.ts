import type { AgriRecord, Farmer, Household } from "@/lib/data";
import { numField } from "@/lib/data";
import { commodityGroupForCommodity, COMMODITY_GROUPS, type CommodityGroup } from "./commodity";
import { cropBagsToMetricTons, type Unit } from "./units";
import type { RecordStatus } from "./status";
import { RECORD_STATUSES } from "./status";
import {
  isFinalizedRecord,
  countsTowardFinalizedProduction,
  countsTowardDamageReports,
  consumesActiveAllocation,
  isHistoricalOnly,
} from "./lifecycle";
import {
  classifyCropDamageSeverity,
  classifyFisheryLossSeverity,
  classifyLivestockLossSeverity,
  maxSeverity,
  type DamageSeverity,
} from "./severity";
import {
  householdUtilization,
  municipalUtilization,
  releasedCropAreaHa,
  type HouseholdUtilization,
} from "./utilization";
import { traceAggregation } from "./audit";

export type MetricsFilter = {
  barangay?: string;
  dateFrom?: string; // inclusive (YYYY-MM-DD)
  dateTo?: string; // inclusive (YYYY-MM-DD)
};

export type PeriodKey = `${number}-${string}`; // e.g. "2026-05" (best-effort)

export type RecordLike = AgriRecord & {
  status?: RecordStatus | null;
  commodity_group?: CommodityGroup | null;
};

function tsRange(filter?: MetricsFilter): { from: number | null; to: number | null } {
  const from = filter?.dateFrom ? new Date(filter.dateFrom + "T00:00:00").getTime() : null;
  const to = filter?.dateTo ? new Date(filter.dateTo + "T00:00:00").getTime() + 86_400_000 : null;
  return { from, to };
}

export function filterRecords(records: RecordLike[], filter?: MetricsFilter): RecordLike[] {
  if (!filter || (!filter.barangay && !filter.dateFrom && !filter.dateTo)) return records;
  const isBarangayFiltered = !!filter.barangay && filter.barangay !== "All";
  const { from, to } = tsRange(filter);
  return records.filter((r) => {
    if (isBarangayFiltered && r.barangay !== filter.barangay) return false;
    const created = new Date(r.created_at).getTime();
    if (from !== null && created < from) return false;
    if (to !== null && created >= to) return false;
    return true;
  });
}

export function recordGroup(r: RecordLike): CommodityGroup {
  return (r.commodity_group as CommodityGroup) ?? commodityGroupForCommodity(r.commodity);
}

export function recordStatus(r: RecordLike): RecordStatus {
  // Phase 2 column (preferred) falls back to Phase 1 lifecycle_status mapping.
  const s = (r.status as RecordStatus | null | undefined) ?? null;
  if (s === "active" || s === "harvested" || s === "damaged" || s === "archived") return s;
  if (r.lifecycle_status === "harvested") return "harvested";
  if (r.lifecycle_status === "total_loss") return "damaged";
  return "active";
}

export function isOfficialProductionRow(r: RecordLike): boolean {
  // Official production excludes ACTIVE and ARCHIVED is just a lock state.
  return countsTowardFinalizedProduction(recordStatus(r));
}

export function getCropMetrics(records: RecordLike[], filter?: MetricsFilter) {
  const recs = filterRecords(records, filter).filter((r) => recordGroup(r) === "CROP");
  return traceAggregation("getCropMetrics", recs.length, () => {
    const harvestedBags = recs.reduce((s, r) => (isOfficialProductionRow(r) ? s + numField(r.harvesting_output_bags) : s), 0);
    return {
      harvestedBags,
      harvestedMetricTons: cropBagsToMetricTons(harvestedBags),
    };
  }, { filter });
}

export function getFisheryMetrics(records: RecordLike[], filter?: MetricsFilter) {
  const recs = filterRecords(records, filter).filter((r) => recordGroup(r) === "FISHERY");
  return traceAggregation("getFisheryMetrics", recs.length, () => {
    const harvestedPieces = recs.reduce((s, r) => (isOfficialProductionRow(r) ? s + numField(r.harvesting_fishery) : s), 0);
    const lossPieces = recs.reduce((s, r) => (recordStatus(r) === "damaged" ? s + numField(r.fishery_loss_pieces) : s), 0);
    return { harvestedPieces, lossPieces };
  }, { filter });
}

export function getLivestockMetrics(records: RecordLike[], filter?: MetricsFilter) {
  const recs = filterRecords(records, filter).filter((r) => recordGroup(r) === "LIVESTOCK");
  return traceAggregation("getLivestockMetrics", recs.length, () => {
    const outputHeads = recs.reduce((s, r) => (isOfficialProductionRow(r) ? s + numField(r.livestock_output_heads) : s), 0);
    const deadHeads = recs.reduce((s, r) => (recordStatus(r) === "damaged" ? s + numField(r.livestock_dead_heads) : s), 0);
    return { outputHeads, deadHeads };
  }, { filter });
}

export function getDamageMetrics(records: RecordLike[], filter?: MetricsFilter) {
  const recs = filterRecords(records, filter);
  return traceAggregation("getDamageMetrics", recs.length, () => {
    const cropFinalizedLossHa = recs.reduce((s, r) => {
      if (recordGroup(r) !== "CROP") return s;
      if (recordStatus(r) !== "damaged") return s;
      // For finalized damaged crop records, treat the whole area as loss to prevent under-reporting.
      return s + numField(r.planting_area_hectares);
    }, 0);

    const cropInSeasonDamageHa = recs.reduce((s, r) => {
      if (recordGroup(r) !== "CROP") return s;
      if (!isFinalizedRecord(recordStatus(r)) && recordStatus(r) !== "active") return s;
      // In-season damage (legacy compatibility): sum damage fields regardless of status,
      // but exclude fishery/livestock and keep this separate from finalized loss.
      return s + numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
    }, 0);

    return {
      cropFinalizedLossHa: +cropFinalizedLossHa.toFixed(2),
      cropInSeasonDamageHa: +cropInSeasonDamageHa.toFixed(2),
    };
  }, { filter });
}

export function getTopCommodity(records: RecordLike[], filter?: MetricsFilter): string {
  // Top commodity is crop-only (bags/tons); other groups are different units.
  const recs = filterRecords(records, filter).filter((r) => recordGroup(r) === "CROP");
  const by: Record<string, number> = {};
  for (const r of recs) {
    if (!isOfficialProductionRow(r)) continue;
    by[r.commodity] = (by[r.commodity] || 0) + numField(r.harvesting_output_bags);
  }
  return Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
}

export function getBarangaySummary(records: RecordLike[], barangays: readonly string[], filter?: Omit<MetricsFilter, "barangay">) {
  const recs = filterRecords(records, filter);
  return traceAggregation("getBarangaySummary", recs.length, () => barangays.map((b) => {
    const br = recs.filter((r) => r.barangay === b);
    const cropBags = br.reduce((s, r) => (recordGroup(r) === "CROP" && isOfficialProductionRow(r) ? s + numField(r.harvesting_output_bags) : s), 0);
    const fisheryFish = br.reduce((s, r) => (recordGroup(r) === "FISHERY" && isOfficialProductionRow(r) ? s + numField(r.harvesting_fishery) : s), 0);
    const livestockHeads = br.reduce((s, r) => (recordGroup(r) === "LIVESTOCK" && isOfficialProductionRow(r) ? s + numField(r.livestock_output_heads) : s), 0);
    const areaActive = br.reduce((s, r) => {
      if (recordGroup(r) !== "CROP") return s;
      return consumesActiveAllocation(recordStatus(r)) ? s + numField(r.planting_area_hectares) : s;
    }, 0);
    const cropDamage = br.reduce((s, r) => {
      if (recordGroup(r) !== "CROP") return s;
      if (isHistoricalOnly(recordStatus(r))) return s;
      return s + numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
    }, 0);
    return {
      barangay: b,
      recordCount: br.length,
      cropBags,
      cropMetricTons: cropBagsToMetricTons(cropBags),
      fisheryFish,
      livestockHeads,
      cropActiveAreaHa: +areaActive.toFixed(2),
      cropDamageHa: +cropDamage.toFixed(2),
    };
  }), { filter });
}

// ── Phase 4 aggregators ────────────────────────────────────────────────────────

/** Per-status histogram with group-aware area / count slices. */
export type LifecycleSummary = Record<
  RecordStatus,
  {
    count: number;
    cropAreaHa: number;
    fisheryStockingPieces: number;
    livestockHeads: number;
  }
>;

export function getLifecycleSummary(records: RecordLike[], filter?: MetricsFilter): LifecycleSummary {
  const recs = filterRecords(records, filter);
  return traceAggregation("getLifecycleSummary", recs.length, () => {
    const out: LifecycleSummary = {
      active: { count: 0, cropAreaHa: 0, fisheryStockingPieces: 0, livestockHeads: 0 },
      harvested: { count: 0, cropAreaHa: 0, fisheryStockingPieces: 0, livestockHeads: 0 },
      damaged: { count: 0, cropAreaHa: 0, fisheryStockingPieces: 0, livestockHeads: 0 },
      archived: { count: 0, cropAreaHa: 0, fisheryStockingPieces: 0, livestockHeads: 0 },
    };
    for (const r of recs) {
      const s = recordStatus(r);
      const g = recordGroup(r);
      out[s].count++;
      if (g === "CROP") out[s].cropAreaHa += numField(r.planting_area_hectares);
      else if (g === "FISHERY") out[s].fisheryStockingPieces += numField(r.stocking);
      else if (g === "LIVESTOCK") out[s].livestockHeads += numField(r.livestock_stocking_heads);
    }
    for (const k of RECORD_STATUSES) {
      out[k].cropAreaHa = +out[k].cropAreaHa.toFixed(2);
      out[k].fisheryStockingPieces = +out[k].fisheryStockingPieces.toFixed(2);
      out[k].livestockHeads = +out[k].livestockHeads.toFixed(2);
    }
    return out;
  }, { filter });
}

export type CapacitySummary = {
  totalCapacityHa: number;
  activeAllocatedHa: number;
  remainingHa: number;
  utilizationPct: number;
  households: number;
  overallocatedHouseholds: number;
  releasedAreaHa: number;
  perHousehold: HouseholdUtilization[];
};

export function getCapacitySummary(
  records: RecordLike[],
  households: Household[],
  farmers: Farmer[],
  filter?: MetricsFilter,
): CapacitySummary {
  const recs = filterRecords(records, filter);
  return traceAggregation("getCapacitySummary", recs.length, () => {
    // Restrict households to the filtered barangay if any.
    const hh = filter?.barangay && filter.barangay !== "All"
      ? households.filter((h) => h.barangay === filter.barangay)
      : households;
    const muni = municipalUtilization(hh, recs, farmers);
    const perHousehold = hh.map((h) => householdUtilization(h, recs, farmers));
    return {
      totalCapacityHa: muni.capacityHa,
      activeAllocatedHa: muni.activeHa,
      remainingHa: muni.remainingHa,
      utilizationPct: muni.utilizationPct,
      households: muni.households,
      overallocatedHouseholds: muni.overallocatedHouseholds,
      releasedAreaHa: releasedCropAreaHa(recs),
      perHousehold,
    };
  }, { filter });
}

export type CropDamageSummary = {
  damageHa: number;
  finalizedLossHa: number;
  affectedFarmers: number;
  byCommodity: { name: string; damageHa: number }[];
  byBarangay: Record<string, number>;
  mostAffected: string | null;
  damagePctOfActive: number;
  trend: "increasing" | "decreasing" | "stable";
  severityCounts: Record<DamageSeverity, number>;
};

export type FisheryDamageSummary = {
  lossPieces: number;
  affectedFarmers: number;
  byCommodity: { name: string; lossPieces: number }[];
  byBarangay: Record<string, number>;
  mostAffected: string | null;
  severityCounts: Record<DamageSeverity, number>;
};

export type LivestockDamageSummary = {
  deadHeads: number;
  affectedFarmers: number;
  byCommodity: { name: string; deadHeads: number }[];
  byBarangay: Record<string, number>;
  mostAffected: string | null;
  severityCounts: Record<DamageSeverity, number>;
};

export type DamageSummary = {
  crop: CropDamageSummary;
  fishery: FisheryDamageSummary;
  livestock: LivestockDamageSummary;
};

function emptySeverityCounts(): Record<DamageSeverity, number> {
  return { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
}

function topKey(map: Record<string, number>): string | null {
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return top[1] > 0 ? top[0] : null;
}

function trendOver(records: RecordLike[], damageOf: (r: RecordLike) => number): "increasing" | "decreasing" | "stable" {
  const sorted = [...records].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (sorted.length < 2) return "stable";
  const mid = Math.floor(sorted.length / 2);
  const older = sorted.slice(0, mid).reduce((s, r) => s + damageOf(r), 0);
  const newer = sorted.slice(mid).reduce((s, r) => s + damageOf(r), 0);
  if (newer > older * 1.1) return "increasing";
  if (newer < older * 0.9) return "decreasing";
  return "stable";
}

export function getDamageSummary(records: RecordLike[], filter?: MetricsFilter): DamageSummary {
  const recs = filterRecords(records, filter).filter((r) => !isHistoricalOnly(recordStatus(r)));
  return traceAggregation("getDamageSummary", recs.length, () => {
  const cropRecs = recs.filter((r) => recordGroup(r) === "CROP");
  const fishRecs = recs.filter((r) => recordGroup(r) === "FISHERY");
  const liveRecs = recs.filter((r) => recordGroup(r) === "LIVESTOCK");

  // ── CROP ─────────────────────────────────────────────────────
  const cropDmgOf = (r: RecordLike) => numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
  const cropDamageHa = cropRecs.reduce((s, r) => s + cropDmgOf(r), 0);
  const cropFinalizedLossHa = cropRecs.reduce(
    (s, r) => (countsTowardDamageReports(recordStatus(r)) ? s + numField(r.planting_area_hectares) : s),
    0,
  );
  const cropActiveAreaHa = cropRecs.reduce(
    (s, r) => (consumesActiveAllocation(recordStatus(r)) ? s + numField(r.planting_area_hectares) : s),
    0,
  );
  // Phase 4 fix: damagePctOfActive should compare ACTIVE-ROW damage to ACTIVE area
  // so the percentage stays bounded in [0, 100]. Earlier this divided total damage
  // (including residual on harvested rows) by active area, which could exceed 100%.
  const cropActiveDamageHa = cropRecs.reduce(
    (s, r) => (consumesActiveAllocation(recordStatus(r)) ? s + cropDmgOf(r) : s),
    0,
  );
  const cropByCommodity: Record<string, number> = {};
  const cropByBarangay: Record<string, number> = {};
  const cropSeverity = emptySeverityCounts();
  let cropAffectedFarmers = 0;
  for (const r of cropRecs) {
    const dmg = cropDmgOf(r);
    if (dmg > 0) {
      cropByCommodity[r.commodity] = (cropByCommodity[r.commodity] || 0) + dmg;
      cropByBarangay[r.barangay] = (cropByBarangay[r.barangay] || 0) + dmg;
      cropAffectedFarmers += r.total_farmers;
    }
    cropSeverity[classifyCropDamageSeverity(dmg)]++;
  }

  const crop: CropDamageSummary = {
    damageHa: +cropDamageHa.toFixed(2),
    finalizedLossHa: +cropFinalizedLossHa.toFixed(2),
    affectedFarmers: cropAffectedFarmers,
    byCommodity: Object.entries(cropByCommodity)
      .map(([name, damageHa]) => ({ name, damageHa: +damageHa.toFixed(2) }))
      .sort((a, b) => b.damageHa - a.damageHa),
    byBarangay: cropByBarangay,
    mostAffected: topKey(cropByBarangay),
    damagePctOfActive: cropActiveAreaHa > 0 ? +((cropActiveDamageHa / cropActiveAreaHa) * 100).toFixed(1) : 0,
    trend: trendOver(cropRecs, cropDmgOf),
    severityCounts: cropSeverity,
  };

  // ── FISHERY ──────────────────────────────────────────────────
  const fishLossOf = (r: RecordLike) => (countsTowardDamageReports(recordStatus(r)) ? numField(r.fishery_loss_pieces) : 0);
  const fishLoss = fishRecs.reduce((s, r) => s + fishLossOf(r), 0);
  const fishByCommodity: Record<string, number> = {};
  const fishByBarangay: Record<string, number> = {};
  const fishSeverity = emptySeverityCounts();
  let fishAffectedFarmers = 0;
  for (const r of fishRecs) {
    const loss = fishLossOf(r);
    if (loss > 0) {
      fishByCommodity[r.commodity] = (fishByCommodity[r.commodity] || 0) + loss;
      fishByBarangay[r.barangay] = (fishByBarangay[r.barangay] || 0) + loss;
      fishAffectedFarmers += r.total_farmers;
    }
    fishSeverity[classifyFisheryLossSeverity(loss, numField(r.stocking))]++;
  }
  const fishery: FisheryDamageSummary = {
    lossPieces: +fishLoss.toFixed(2),
    affectedFarmers: fishAffectedFarmers,
    byCommodity: Object.entries(fishByCommodity)
      .map(([name, lossPieces]) => ({ name, lossPieces: +lossPieces.toFixed(2) }))
      .sort((a, b) => b.lossPieces - a.lossPieces),
    byBarangay: fishByBarangay,
    mostAffected: topKey(fishByBarangay),
    severityCounts: fishSeverity,
  };

  // ── LIVESTOCK ────────────────────────────────────────────────
  const liveLossOf = (r: RecordLike) => (countsTowardDamageReports(recordStatus(r)) ? numField(r.livestock_dead_heads) : 0);
  const liveLoss = liveRecs.reduce((s, r) => s + liveLossOf(r), 0);
  const liveByCommodity: Record<string, number> = {};
  const liveByBarangay: Record<string, number> = {};
  const liveSeverity = emptySeverityCounts();
  let liveAffectedFarmers = 0;
  for (const r of liveRecs) {
    const loss = liveLossOf(r);
    if (loss > 0) {
      liveByCommodity[r.commodity] = (liveByCommodity[r.commodity] || 0) + loss;
      liveByBarangay[r.barangay] = (liveByBarangay[r.barangay] || 0) + loss;
      liveAffectedFarmers += r.total_farmers;
    }
    liveSeverity[classifyLivestockLossSeverity(loss, numField(r.livestock_stocking_heads))]++;
  }
  const livestock: LivestockDamageSummary = {
    deadHeads: +liveLoss.toFixed(2),
    affectedFarmers: liveAffectedFarmers,
    byCommodity: Object.entries(liveByCommodity)
      .map(([name, deadHeads]) => ({ name, deadHeads: +deadHeads.toFixed(2) }))
      .sort((a, b) => b.deadHeads - a.deadHeads),
    byBarangay: liveByBarangay,
    mostAffected: topKey(liveByBarangay),
    severityCounts: liveSeverity,
  };

  return { crop, fishery, livestock };
  }, { filter });
}

/** Production by commodity, scoped to one group at a time so units never mix. */
export type ProductionByCommodity = { name: string; value: number; unit: Unit };

export function getProductionByCommodity(
  records: RecordLike[],
  group: CommodityGroup,
  filter?: MetricsFilter,
): ProductionByCommodity[] {
  const recs = filterRecords(records, filter)
    .filter((r) => recordGroup(r) === group)
    .filter((r) => isOfficialProductionRow(r));
  return traceAggregation(`getProductionByCommodity:${group}`, recs.length, () => {
    const by: Record<string, number> = {};
    for (const r of recs) {
      let v = 0;
      if (group === "CROP") v = numField(r.harvesting_output_bags);
      else if (group === "FISHERY") v = numField(r.harvesting_fishery);
      else if (group === "LIVESTOCK") v = numField(r.livestock_output_heads);
      if (v <= 0) continue;
      by[r.commodity] = (by[r.commodity] || 0) + v;
    }
    const unit: Unit = group === "CROP" ? "bags" : group === "FISHERY" ? "pieces" : "heads";
    return Object.entries(by)
      .map(([name, value]) => ({ name, value: +value.toFixed(2), unit }))
      .sort((a, b) => b.value - a.value);
  }, { filter });
}

/** Per-barangay risk ranking with a single worst-of-three severity rating. */
export type RiskRankingRow = {
  barangay: string;
  severity: DamageSeverity;
  cropDamageHa: number;
  fisheryLossPieces: number;
  livestockDeadHeads: number;
  affectedFarmers: number;
};

export function getRiskRanking(
  records: RecordLike[],
  barangays: readonly string[],
  filter?: MetricsFilter,
): RiskRankingRow[] {
  const recs = filterRecords(records, filter).filter((r) => !isHistoricalOnly(recordStatus(r)));
  return traceAggregation("getRiskRanking", recs.length, () => barangays
    .map((b): RiskRankingRow => {
      const inB = recs.filter((r) => r.barangay === b);
      const cropDmg = inB
        .filter((r) => recordGroup(r) === "CROP")
        .reduce((s, r) => s + numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares), 0);
      const fishLoss = inB
        .filter((r) => recordGroup(r) === "FISHERY" && countsTowardDamageReports(recordStatus(r)))
        .reduce((s, r) => s + numField(r.fishery_loss_pieces), 0);
      const liveLoss = inB
        .filter((r) => recordGroup(r) === "LIVESTOCK" && countsTowardDamageReports(recordStatus(r)))
        .reduce((s, r) => s + numField(r.livestock_dead_heads), 0);
      // For severity, use proportional context on fishery/livestock (total stocked across barangay).
      const fishStock = inB
        .filter((r) => recordGroup(r) === "FISHERY")
        .reduce((s, r) => s + numField(r.stocking), 0);
      const liveStock = inB
        .filter((r) => recordGroup(r) === "LIVESTOCK")
        .reduce((s, r) => s + numField(r.livestock_stocking_heads), 0);
      const affected = inB
        .filter((r) => {
          if (recordGroup(r) === "CROP") {
            return numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares) > 0;
          }
          if (!countsTowardDamageReports(recordStatus(r))) return false;
          if (recordGroup(r) === "FISHERY") return numField(r.fishery_loss_pieces) > 0;
          if (recordGroup(r) === "LIVESTOCK") return numField(r.livestock_dead_heads) > 0;
          return false;
        })
        .reduce((s, r) => s + r.total_farmers, 0);
      const severity = maxSeverity(
        classifyCropDamageSeverity(cropDmg),
        classifyFisheryLossSeverity(fishLoss, fishStock),
        classifyLivestockLossSeverity(liveLoss, liveStock),
      );
      return {
        barangay: b,
        severity,
        cropDamageHa: +cropDmg.toFixed(2),
        fisheryLossPieces: +fishLoss.toFixed(2),
        livestockDeadHeads: +liveLoss.toFixed(2),
        affectedFarmers: affected,
      };
    })
    .sort((a, b) => {
      // Sort by severity rank desc, then by absolute damage desc.
      const sevDiff = ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(b.severity) -
        ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(a.severity);
      if (sevDiff !== 0) return sevDiff;
      return (b.cropDamageHa + b.fisheryLossPieces + b.livestockDeadHeads) -
        (a.cropDamageHa + a.fisheryLossPieces + a.livestockDeadHeads);
    }), { filter });
}

/** Convenience: list every group present in the slice. */
export function presentGroups(records: RecordLike[], filter?: MetricsFilter): CommodityGroup[] {
  const recs = filterRecords(records, filter);
  const set = new Set<CommodityGroup>();
  for (const r of recs) set.add(recordGroup(r));
  return COMMODITY_GROUPS.filter((g) => set.has(g));
}

