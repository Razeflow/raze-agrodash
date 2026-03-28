"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { BARANGAYS } from "@/lib/data";
import { Trophy, ArrowUpDown } from "lucide-react";

type SortKey = "production" | "farmers" | "entries" | "area";

const RANK_COLORS = ["#ca8a04", "#9ca3af", "#b45309"]; // gold, silver, bronze

export default function BarangayLeaderboard() {
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

  if (records.length === 0) return null; // hide when no data

  return (
    <div className="fade-up delay-2 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Barangay Leaderboard</h2>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown size={12} className="text-gray-400" />
          <select
            className="appearance-none rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 outline-none focus:border-green-400 transition"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="production">Production (bags)</option>
            <option value="farmers">Farmers</option>
            <option value="entries">Entries</option>
            <option value="area">Area (ha)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {data.map((b, i) => {
          const barWidth = maxVal > 0 ? Math.max(4, (b[sortBy] / maxVal) * 100) : 4;
          const rankColor = i < 3 ? RANK_COLORS[i] : "#d1d5db";
          const isActive = b[sortBy] > 0;

          return (
            <div key={b.name} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${isActive ? "hover:bg-green-50/50" : "opacity-50"}`}>
              {/* Rank */}
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: rankColor }}
              >
                {i + 1}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700 truncate">{b.name}</span>
                  <span className="font-mono text-xs font-bold text-gray-600 shrink-0 ml-2">
                    {sortBy === "production" ? `${b.production.toLocaleString()} bags` :
                     sortBy === "farmers" ? `${b.farmers} farmers` :
                     sortBy === "entries" ? `${b.entries} entries` :
                     `${b.area.toFixed(1)} ha`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, background: i === 0 ? "#16a34a" : i === 1 ? "#22c55e" : i === 2 ? "#4ade80" : "#86efac" }}
                  />
                </div>
              </div>

              {/* Mini stats */}
              <div className="hidden lg:flex gap-4 shrink-0">
                <div className="text-center">
                  <p className="font-mono text-xs font-semibold text-gray-600">{b.entries}</p>
                  <p className="text-[10px] text-gray-400">entries</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-semibold text-gray-600">{b.farmers}</p>
                  <p className="text-[10px] text-gray-400">farmers</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-semibold text-green-600">{b.production.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">bags</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
