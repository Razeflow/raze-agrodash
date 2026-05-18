"use client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { productionOutputForRecord } from "@/lib/data";
import { COMMODITY_COLORS, COMMODITY_OPTIONS } from "@/lib/data";
import BentoCard from "@/components/ui/BentoCard";
import { Warehouse } from "lucide-react";

const tooltipStyle = {
  borderRadius: "1.5rem",
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  fontSize: 12,
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
};

// Use the canonical list from lib/data.ts so a new commodity (e.g. Livestock)
// automatically appears as a tab here — previously the hardcoded list dropped
// Livestock even though the rendering logic below supports it.
const COMMODITIES = COMMODITY_OPTIONS;

type SubCategoryBarRow = { name: string; output: number; mt?: number };

export default function SubCategoryAnalytics({
  barangayFilter,
  dateFrom,
  dateTo,
}: {
  barangayFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { records: allRecords } = useAgriData();
  const isBarangayFiltered = !!barangayFilter && barangayFilter !== "All";
  const records = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T00:00:00").getTime() + 86_400_000 : null;
    return allRecords.filter((r) => {
      if (isBarangayFiltered && r.barangay !== barangayFilter) return false;
      const created = new Date(r.created_at).getTime();
      if (fromTs !== null && created < fromTs) return false;
      if (toTs !== null && created >= toTs) return false;
      return true;
    });
  }, [allRecords, isBarangayFiltered, barangayFilter, dateFrom, dateTo]);
  const [active, setActive] = useState<string>("Rice");
  const color = COMMODITY_COLORS[active];

  const subData = useMemo((): SubCategoryBarRow[] => {
    const totals: Record<string, number> = {};
    records
      .filter((r) => r.commodity === active)
      .forEach((r) => {
        totals[r.sub_category] = (totals[r.sub_category] || 0) + productionOutputForRecord(r);
      });
    return Object.entries(totals)
      .map(([name, output]): SubCategoryBarRow => {
        if (active === "Fishery" || active === "Livestock") return { name, output };
        return { name, output, mt: +(output * 0.04).toFixed(2) };
      })
      .sort((a, b) => b.output - a.output);
  }, [records, active]);

  const tooltipFmt = (v: number) => {
    if (active === "Fishery") return [`${Number(v).toLocaleString()} fish`, "Harvest"];
    if (active === "Livestock") return [`${Number(v).toLocaleString()} heads`, "Output"];
    return [`${Number(v).toLocaleString()} bags`, "Crop harvest"];
  };

  return (
    <BentoCard
      variant="compact"
      title="Sub-Category Breakdown"
      subtitle={
        active === "Fishery"
          ? "Fish count per species (harvested rows)"
          : active === "Livestock"
            ? "Head count per type (harvested rows)"
            : "Crop output in bags (40 kg each, harvested rows)"
      }
      icon={Warehouse}
      className="fade-up delay-2"
    >
      <div className="mb-6 flex flex-wrap gap-3">
        {COMMODITIES.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className="rounded-[1.5rem] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border"
            style={
              active === c
                ? { background: COMMODITY_COLORS[c], color: "#fff", borderColor: COMMODITY_COLORS[c], boxShadow: `0 10px 25px -5px ${COMMODITY_COLORS[c]}33` }
                : { background: "rgba(255,255,255,0.5)", color: "#94a3b8", borderColor: "rgba(255,255,255,0.4)" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {subData.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-slate-400">No {active} records yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={subData} barSize={30} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => tooltipFmt(Number(v))} />
              <Bar dataKey="output" radius={[8, 8, 0, 0]} fill={color}>
                {subData.map((_, i) => (
                  <Cell key={i} fill={color} opacity={1 - i * 0.1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 divide-y divide-slate-100/60">
            {subData.map((d) => (
              <div key={d.name} className="flex items-center justify-between py-2.5">
                <span className="text-xs font-bold text-slate-600">{d.name}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 rounded-full" style={{
                    width: `${Math.round((d.output / subData[0].output) * 80)}px`,
                    background: color,
                    opacity: 0.3,
                  }} />
                  <span className="w-16 text-right text-xs font-black" style={{ fontFamily: "Space Mono", color }}>
                    {d.output.toLocaleString()}
                  </span>
                  {d.mt !== undefined ? (
                    <span className="w-12 text-right text-xs font-medium text-slate-400">{d.mt} MT</span>
                  ) : (
                    <span className="w-12 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {active === "Fishery" ? "fish" : "hd"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </BentoCard>
  );
}
