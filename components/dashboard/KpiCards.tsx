"use client";
import { useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import StatStrip from "@/components/ui/StatStrip";

export default function KpiCards({ barangayFilter }: { barangayFilter?: string }) {
  const { totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity, records, farmers } = useAgriData();

  const isFiltered = barangayFilter && barangayFilter !== "All";

  const stats = useMemo(() => {
    if (!isFiltered) return { totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity };
    const fr = records.filter((r) => r.barangay === barangayFilter);
    const ff = farmers.filter((f) => f.barangay === barangayFilter);
    const male = ff.filter((f) => f.gender === "Male").length;
    const female = ff.filter((f) => f.gender === "Female").length;
    const bags = fr.reduce((s, r) => s + r.harvesting_output_bags, 0);
    const area = +fr.reduce((s, r) => s + r.planting_area_hectares, 0).toFixed(2);
    const dmg = +fr.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0).toFixed(2);
    const prodByCom: Record<string, number> = {};
    fr.forEach((r) => {
      prodByCom[r.commodity] = (prodByCom[r.commodity] || 0) + r.harvesting_output_bags;
    });
    const top = Object.entries(prodByCom).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    return {
      totalFarmers: { male, female, total: ff.length },
      totalProduction: { bags, tons: +(bags * 0.04).toFixed(2) },
      totalPlantingArea: area,
      totalDamagedArea: dmg,
      mostProducedCommodity: top,
    };
  }, [isFiltered, barangayFilter, records, farmers, totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity]);

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
        label: "Total production",
        value: `${stats.totalProduction.tons.toLocaleString()} MT`,
        hint: `${stats.totalProduction.bags.toLocaleString()} bags (40 kg/bag)`,
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
    ],
    [stats],
  );

  return <StatStrip items={items} />;
}
