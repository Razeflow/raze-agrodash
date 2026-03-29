"use client";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { Users, Wheat, MapPin, AlertTriangle, Trophy } from "lucide-react";

const kpiCardStyle = () =>
  `relative overflow-hidden rounded-2xl border p-5 bg-white shadow-sm transition-shadow hover:shadow-md`;

export default function KpiCards() {
  const { totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity } = useAgriData();
  const topColor = COMMODITY_COLORS[mostProducedCommodity] || "#16a34a";

  const cards = [
    {
      label: "Total Farmers",
      value: totalFarmers.total.toLocaleString(),
      sub: `${totalFarmers.male.toLocaleString()} male · ${totalFarmers.female.toLocaleString()} female`,
      icon: Users,
      color: "#16a34a",
      bg: "#f0faf0",
      delay: "",
    },
    {
      label: "Total Production",
      value: `${totalProduction.tons.toLocaleString()} MT`,
      sub: `${totalProduction.bags.toLocaleString()} bags (40 kg/bag)`,
      icon: Wheat,
      color: "#ca8a04",
      bg: "#fefce8",
      delay: "delay-1",
    },
    {
      label: "Total Planting Area",
      value: `${totalPlantingArea.toLocaleString()} ha`,
      sub: "Across all commodities",
      icon: MapPin,
      color: "#0284c7",
      bg: "#f0f9ff",
      delay: "delay-2",
    },
    {
      label: "Total Damaged Area",
      value: `${totalDamagedArea.toLocaleString()} ha`,
      sub: "Pests, diseases & calamities",
      icon: AlertTriangle,
      color: "#dc2626",
      bg: "#fff1f1",
      delay: "delay-3",
    },
    {
      label: "Top Commodity",
      value: mostProducedCommodity,
      sub: "Highest production output",
      icon: Trophy,
      color: topColor,
      bg: "#faf8ff",
      delay: "delay-4",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className={`${kpiCardStyle()} fade-up ${c.delay}`}>
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
            style={{ background: c.color }}
          />
          <div className="pl-1">
            <div
              className="mb-3 inline-flex items-center justify-center rounded-xl p-2"
              style={{ background: c.bg }}
            >
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#6b7280" }}
            >
              {c.label}
            </p>
            <p
              className="mt-1 text-2xl font-bold leading-tight"
              style={{
                fontFamily: "Space Mono, monospace",
                color: "#1a2e1a",
                fontSize: c.label === "Top Commodity" ? "1.1rem" : undefined,
              }}
            >
              {c.value}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#9aada9" }}>
              {c.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
