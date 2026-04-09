"use client";
import { useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { Users, Wheat, MapPin, AlertTriangle, Trophy } from "lucide-react";

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
    fr.forEach((r) => { prodByCom[r.commodity] = (prodByCom[r.commodity] || 0) + r.harvesting_output_bags; });
    const top = Object.entries(prodByCom).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    return {
      totalFarmers: { male, female, total: ff.length },
      totalProduction: { bags, tons: +(bags * 0.04).toFixed(2) },
      totalPlantingArea: area,
      totalDamagedArea: dmg,
      mostProducedCommodity: top,
    };
  }, [isFiltered, barangayFilter, records, farmers, totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity]);

  const topColor = COMMODITY_COLORS[stats.mostProducedCommodity] || "#16a34a";

  const cards = [
    {
      label: "Total Farmers",
      value: stats.totalFarmers.total.toLocaleString(),
      sub: `${stats.totalFarmers.male.toLocaleString()} male · ${stats.totalFarmers.female.toLocaleString()} female`,
      icon: Users,
      color: "#16a34a",
      delay: "",
    },
    {
      label: "Total Production",
      value: `${stats.totalProduction.tons.toLocaleString()} MT`,
      sub: `${stats.totalProduction.bags.toLocaleString()} bags (40 kg/bag)`,
      icon: Wheat,
      color: "#ca8a04",
      delay: "delay-1",
    },
    {
      label: "Total Planting Area",
      value: `${stats.totalPlantingArea.toLocaleString()} ha`,
      sub: "Across all commodities",
      icon: MapPin,
      color: "#0284c7",
      delay: "delay-2",
    },
    {
      label: "Total Damaged Area",
      value: `${stats.totalDamagedArea.toLocaleString()} ha`,
      sub: "Pests, diseases & calamities",
      icon: AlertTriangle,
      color: "#dc2626",
      delay: "delay-3",
    },
    {
      label: "Top Commodity",
      value: stats.mostProducedCommodity,
      sub: "Highest production output",
      icon: Trophy,
      color: topColor,
      delay: "delay-4",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`group bg-white/70 backdrop-blur-xl border border-white/40 rounded-[2rem] p-6 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-500 fade-up ${c.delay}`}
        >
          <div
            className="mb-3 inline-flex items-center justify-center p-3 bg-white border border-slate-100 rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300"
          >
            <c.icon size={18} style={{ color: c.color }} className="group-hover:!text-white transition-colors duration-300" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {c.label}
          </p>
          <p
            className="mt-1 text-2xl font-black leading-tight text-slate-900"
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: c.label === "Top Commodity" ? "1.1rem" : undefined,
            }}
          >
            {c.value}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
