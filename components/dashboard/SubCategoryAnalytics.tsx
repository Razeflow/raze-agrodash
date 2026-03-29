"use client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";

const COMMODITIES = ["Rice", "Corn", "Fishery", "High Value Crops", "Industrial Crops"] as const;

export default function SubCategoryAnalytics({ barangayFilter }: { barangayFilter?: string }) {
  const { records: allRecords } = useAgriData();
  const isFiltered = barangayFilter && barangayFilter !== "All";
  const records = useMemo(() => isFiltered ? allRecords.filter((r) => r.barangay === barangayFilter) : allRecords, [allRecords, isFiltered, barangayFilter]);
  const [active, setActive] = useState<string>("Rice");
  const color = COMMODITY_COLORS[active];

  const subData = useMemo(() => {
    const totals: Record<string, number> = {};
    records
      .filter((r) => r.commodity === active)
      .forEach((r) => {
        totals[r.sub_category] = (totals[r.sub_category] || 0) + r.harvesting_output_bags;
      });
    return Object.entries(totals)
      .map(([name, bags]) => ({ name, bags, tons: +(bags * 0.04).toFixed(2) }))
      .sort((a, b) => b.bags - a.bags);
  }, [records, active]);

  return (
    <div className="fade-up delay-2 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Sub-Category Breakdown
      </h2>
      <p className="mb-4 text-xs text-gray-400">Production per variety / type</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {COMMODITIES.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={
              active === c
                ? { background: COMMODITY_COLORS[c], color: "#fff" }
                : { background: "#f3f4f6", color: "#555" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {subData.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No {active} records yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={subData} barSize={30} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#888", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} formatter={(v: any) => [`${v.toLocaleString()} bags`, "Output"]} />
              <Bar dataKey="bags" radius={[6, 6, 0, 0]} fill={color}>
                {subData.map((_, i) => (
                  <Cell key={i} fill={color} opacity={1 - i * 0.1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 divide-y divide-gray-50">
            {subData.map((d) => (
              <div key={d.name} className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-600">{d.name}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 rounded-full" style={{
                    width: `${Math.round((d.bags / subData[0].bags) * 80)}px`,
                    background: color,
                    opacity: 0.3,
                  }} />
                  <span className="w-16 text-right text-xs font-semibold" style={{ fontFamily: "Space Mono", color }}>
                    {d.bags.toLocaleString()}
                  </span>
                  <span className="w-12 text-right text-xs text-gray-400">{d.tons} MT</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
