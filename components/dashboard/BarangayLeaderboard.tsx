"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { BARANGAYS } from "@/lib/data";
import { Trophy, ArrowUpDown } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";

type SortKey = "production" | "farmers" | "entries" | "area";

const RANK_COLORS = ["#ca8a04", "#9ca3af", "#b45309"]; // gold, silver, bronze

export default function BarangayLeaderboard({ barangayFilter }: { barangayFilter?: string }) {
  const { records } = useAgriData();
  const [sortBy, setSortBy] = useState<SortKey>("production");

  const data = useMemo(() => {
    const stats: Record<string, { entries: number; farmers: number; production: number; area: number }> = {};
    BARANGAYS.forEach((b) => { stats[b] = { entries: 0, farmers: 0, production: 0, area: 0 }; });
    records.forEach((r) => {
      if (stats[r.barangay]) {
        stats[r.barangay].entries++;
        stats[r.barangay].farmers += r.total_farmers;
        stats[r.barangay].production += r.harvesting_output_bags;
        stats[r.barangay].area += r.planting_area_hectares;
      }
    });
    return Object.entries(stats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [records, sortBy]);

  const maxVal = data[0]?.[sortBy] || 1;

  if (records.length === 0) return null;

  const sortDropdown = (
    <div className="flex items-center gap-2">
      <ArrowUpDown size={12} className="text-slate-400" />
      <select
        className="appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-emerald-400 transition"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortKey)}
      >
        <option value="production">Production</option>
        <option value="farmers">Farmers</option>
        <option value="entries">Entries</option>
        <option value="area">Area (ha)</option>
      </select>
    </div>
  );

  return (
    <BentoCard title="Barangay Leaderboard" subtitle="Ranked by performance" icon={Trophy} action={sortDropdown} className="fade-up delay-2">
      <div className="space-y-2">
        {data.map((b, i) => {
          const barWidth = maxVal > 0 ? Math.max(4, (b[sortBy] / maxVal) * 100) : 4;
          const rankColor = i < 3 ? RANK_COLORS[i] : "#cbd5e1";
          const isActive = b[sortBy] > 0;
          const isHighlighted = barangayFilter && barangayFilter !== "All" && b.name === barangayFilter;

          return (
            <div key={b.name} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${isHighlighted ? "bg-emerald-50 ring-2 ring-emerald-400" : ""} ${isActive ? "hover:bg-white/50" : "opacity-40"}`}>
              {/* Rank */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                style={{ background: rankColor }}
              >
                {i + 1}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 truncate">{b.name}</span>
                  <span className="font-mono text-xs font-black text-slate-600 shrink-0 ml-2">
                    {sortBy === "production" ? `${b.production.toLocaleString()} bags` :
                     sortBy === "farmers" ? `${b.farmers} farmers` :
                     sortBy === "entries" ? `${b.entries} entries` :
                     `${b.area.toFixed(1)} ha`}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100/60">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%`, background: i === 0 ? "#10b981" : i === 1 ? "#34d399" : i === 2 ? "#6ee7b7" : "#a7f3d0" }}
                  />
                </div>
              </div>

              {/* Mini stats */}
              <div className="hidden lg:flex gap-5 shrink-0">
                <div className="text-center">
                  <p className="font-mono text-xs font-bold text-slate-600">{b.entries}</p>
                  <p className="text-[10px] font-bold text-slate-400">entries</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-bold text-slate-600">{b.farmers}</p>
                  <p className="text-[10px] font-bold text-slate-400">farmers</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-bold text-emerald-600">{b.production.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400">bags</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
