"use client";
import { useMemo } from "react";
// Phase G: migrated from `useAgriData()` to the narrow hooks. Each subscription
// now only re-renders this component when its specific slice changes.
import { useMetrics } from "@/lib/contexts/metrics-context";
import { useRecords } from "@/lib/contexts/records-context";
import { useFarmers } from "@/lib/contexts/farmers-context";
import { usePrograms } from "@/lib/contexts/programs-context";
import {
  filterRecords,
  getCapacitySummary,
  getCropMetrics,
  getFisheryMetrics,
  getLifecycleSummary,
  getLivestockMetrics,
  getTopCommodity,
  recordGroup,
  recordStatus,
} from "@/lib/domain/metrics";
import StatStrip from "@/components/ui/StatStrip";

export default function KpiCards({
  barangayFilter,
  dateFrom,
  dateTo,
}: {
  barangayFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  // Metrics are the headline data for every tile.
  const {
    totalFarmers,
    totalProduction,
    totalPlantingArea,
    totalDamagedArea,
    mostProducedCommodity,
    lifecycleSummary,
    capacitySummary,
  } = useMetrics();
  // Raw lists only consumed in the filtered branch (re-run metrics on the slice).
  const { records } = useRecords();
  const { farmers } = useFarmers();
  const { households } = usePrograms();

  const isBarangayFiltered = !!barangayFilter && barangayFilter !== "All";
  const isDateFiltered = !!dateFrom || !!dateTo;
  const isFiltered = isBarangayFiltered || isDateFiltered;

  const stats = useMemo(() => {
    if (!isFiltered) {
      return {
        totalFarmers,
        totalProduction,
        totalPlantingArea,
        totalDamagedArea,
        mostProducedCommodity,
        lifecycleSummary,
        capacitySummary,
      };
    }

    const fr = filterRecords(records as any, {
      barangay: isBarangayFiltered ? barangayFilter : undefined,
      dateFrom,
      dateTo,
    });
    const ff = isBarangayFiltered ? farmers.filter((f) => f.barangay === barangayFilter) : farmers;
    const fh = isBarangayFiltered ? households.filter((h) => h.barangay === barangayFilter) : households;
    const male = ff.filter((f) => f.gender === "Male").length;
    const female = ff.filter((f) => f.gender === "Female").length;

    const crop = getCropMetrics(fr as any);
    const fishery = getFisheryMetrics(fr as any);
    const livestock = getLivestockMetrics(fr as any);

    const area = +fr
      .filter((r) => recordGroup(r as any) === "CROP" && recordStatus(r as any) === "active")
      .reduce((s, r) => s + Number(r.planting_area_hectares || 0), 0)
      .toFixed(2);
    const dmg = +fr
      .filter((r) => recordGroup(r as any) === "CROP")
      .reduce((s, r) => s + Number(r.damage_pests_hectares || 0) + Number(r.damage_calamity_hectares || 0), 0)
      .toFixed(2);
    const top = getTopCommodity(fr as any);
    return {
      totalFarmers: { male, female, total: ff.length },
      totalProduction: {
        cropBags: crop.harvestedBags,
        cropTons: crop.harvestedMetricTons,
        fisheryPieces: fishery.harvestedPieces,
        livestockHeads: livestock.outputHeads,
      },
      totalPlantingArea: area,
      totalDamagedArea: dmg,
      mostProducedCommodity: top,
      lifecycleSummary: getLifecycleSummary(fr as any),
      capacitySummary: getCapacitySummary(fr as any, fh, ff),
    };
  }, [
    isFiltered,
    isBarangayFiltered,
    barangayFilter,
    dateFrom,
    dateTo,
    records,
    farmers,
    households,
    totalFarmers,
    totalProduction,
    totalPlantingArea,
    totalDamagedArea,
    mostProducedCommodity,
    lifecycleSummary,
    capacitySummary,
  ]);

  const items = useMemo(
    () => [
      {
        id: "farmers",
        label: "Total farmers",
        value: stats.totalFarmers.total.toLocaleString(),
        hint: `${stats.totalFarmers.male.toLocaleString()} male · ${stats.totalFarmers.female.toLocaleString()} female`,
      },
      {
        id: "production",
        label: "Crop production",
        value: `${stats.totalProduction.cropTons.toLocaleString()} MT`,
        hint: `${stats.totalProduction.cropBags.toLocaleString()} bags · Fishery: ${stats.totalProduction.fisheryPieces.toLocaleString()} fish · Livestock: ${stats.totalProduction.livestockHeads.toLocaleString()} heads`,
      },
      {
        id: "planting",
        label: "Planting area",
        value: `${stats.totalPlantingArea.toLocaleString()} ha`,
        hint: "Across all commodities",
      },
      {
        id: "damaged",
        label: "Damaged area",
        value: `${stats.totalDamagedArea.toLocaleString()} ha`,
        hint: "Pests, diseases and calamities",
      },
      {
        id: "top",
        label: "Top commodity",
        value: stats.mostProducedCommodity,
        hint: "Highest production output",
      },
      {
        id: "capacity",
        label: "Capacity utilization",
        value: `${stats.capacitySummary.utilizationPct.toFixed(1)}%`,
        hint: `${stats.capacitySummary.activeAllocatedHa.toFixed(1)} ha active / ${stats.capacitySummary.totalCapacityHa.toFixed(1)} ha capacity${stats.capacitySummary.overallocatedHouseholds > 0 ? ` · ⚠ ${stats.capacitySummary.overallocatedHouseholds} over` : ""}`,
      },
      {
        id: "lifecycle",
        label: "Active records",
        value: stats.lifecycleSummary.active.count.toLocaleString(),
        hint: `${stats.lifecycleSummary.harvested.count.toLocaleString()} harvested · ${stats.lifecycleSummary.damaged.count.toLocaleString()} damaged · ${stats.lifecycleSummary.archived.count.toLocaleString()} archived`,
      },
    ],
    [stats],
  );

  return <StatStrip items={items} />;
}
