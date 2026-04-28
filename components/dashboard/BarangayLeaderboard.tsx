"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { BARANGAYS } from "@/lib/data";
import { Trophy, ArrowUpDown, CloudLightning, Sprout } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";

type SortKey = "production" | "farmers" | "entries" | "area" | "calamity";

const RANK_COLORS = ["#ca8a04", "#9ca3af", "#b45309"]; // gold, silver, bronze

type Row = {
  name: string;
  entries: number;
  farmers: number;
  production: number;
  area: number;
  calamityHa: number;
  commodityTypes: number;
};

function sortMetric(row: Row, key: SortKey): number {
  switch (key) {
    case "calamity":
      return row.calamityHa;
    case "production":
      return row.production;
    case "farmers":
      return row.farmers;
    case "entries":
      return row.entries;
    case "area":
      return row.area;
  }
}

export default function BarangayLeaderboard({
  barangayFilter,
  dateFrom,
  dateTo,
}: {
  barangayFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { records } = useAgriData();
  const [sortBy, setSortBy] = useState<SortKey>("production");

  const rowsUnsorted = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T00:00:00").getTime() + 86_400_000 : null;
    const dateFilteredRecords = records.filter((r) => {
      const created = new Date(r.created_at).getTime();
      if (fromTs !== null && created < fromTs) return false;
      if (toTs !== null && created >= toTs) return false;
      return true;
    });

    const stats: Record<string, Omit<Row, "name" | "commodityTypes">> = {};
    const commoditiesByBrgy: Record<string, Set<string>> = {};
    BARANGAYS.forEach((b) => {
      stats[b] = { entries: 0, farmers: 0, production: 0, area: 0, calamityHa: 0 };
      commoditiesByBrgy[b] = new Set();
    });
    dateFilteredRecords.forEach((r) => {
      if (!stats[r.barangay]) return;
      stats[r.barangay].entries++;
      stats[r.barangay].farmers += r.total_farmers;
      stats[r.barangay].production += r.harvesting_output_bags;
      stats[r.barangay].area += r.planting_area_hectares;
      stats[r.barangay].calamityHa += r.damage_calamity_hectares;
      commoditiesByBrgy[r.barangay].add(r.commodity);
    });
    return BARANGAYS.map((name) => ({
      name,
      ...stats[name],
      commodityTypes: commoditiesByBrgy[name].size,
    }));
  }, [records, dateFrom, dateTo]);

  const data = useMemo(
    () => [...rowsUnsorted].sort((a, b) => sortMetric(b, sortBy) - sortMetric(a, sortBy)),
    [rowsUnsorted, sortBy],
  );

  const insights = useMemo(() => {
    const hasAnyRows = rowsUnsorted.some((r) => r.entries > 0);
    if (rowsUnsorted.length === 0) {
      return {
        topCalamity: null as Row | null,
        topCommodityTypes: null as Row | null,
        topProduction: null as Row | null,
        allCalamityZero: true,
        allCommodityTypesZero: true,
        noRecords: !hasAnyRows,
      };
    }
    const topCalamity = rowsUnsorted.reduce((best, r) => (r.calamityHa > best.calamityHa ? r : best));
    const topCommodityTypes = rowsUnsorted.reduce((best, r) =>
      r.commodityTypes > best.commodityTypes || (r.commodityTypes === best.commodityTypes && r.production > best.production)
        ? r
        : best,
    );
    const topProduction = rowsUnsorted.reduce((best, r) => (r.production > best.production ? r : best));
    const allCalamityZero = rowsUnsorted.every((r) => r.calamityHa === 0);
    const allCommodityTypesZero = rowsUnsorted.every((r) => r.commodityTypes === 0);
    return {
      topCalamity,
      topCommodityTypes,
      topProduction,
      allCalamityZero,
      allCommodityTypesZero,
      noRecords: !hasAnyRows,
    };
  }, [rowsUnsorted]);

  const maxVal = useMemo(() => {
    const m = Math.max(...data.map((r) => sortMetric(r, sortBy)), 0);
    return m > 0 ? m : 1;
  }, [data, sortBy]);

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
        <option value="calamity">Calamity (ha)</option>
      </select>
    </div>
  );

  const formatSortValue = (b: Row) => {
    switch (sortBy) {
      case "production":
        return `${b.production.toLocaleString()} bags`;
      case "farmers":
        return `${b.farmers} farmers`;
      case "entries":
        return `${b.entries} entries`;
      case "area":
        return `${b.area.toFixed(1)} ha`;
      case "calamity":
        return `${b.calamityHa.toFixed(2)} ha`;
      default:
        return "";
    }
  };

  const topCal = insights.topCalamity;
  const topTypes = insights.topCommodityTypes;
  const topProd = insights.topProduction;

  return (
    <BentoCard
      variant="compact"
      title="Barangay Leaderboard"
      subtitle="Ranked by performance · all barangays shown (zeros included)"
      icon={Trophy}
      action={sortDropdown}
      className="fade-up delay-2"
    >
      {topCal && topTypes && topProd ? (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-100/80 bg-slate-50/50 p-3 text-xs text-slate-600">
          <div className="flex gap-2">
            <CloudLightning size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              {insights.noRecords ? (
                <>
                  <span className="font-bold text-slate-800">Disaster risk (calamity damage):</span> no records yet —{" "}
                  <strong>0 ha</strong> for every barangay. Log production records with{" "}
                  <strong>calamity damage (ha)</strong> to rank exposure by barangay.
                </>
              ) : insights.allCalamityZero ? (
                <>
                  <span className="font-bold text-slate-800">Disaster risk (calamity damage):</span>{" "}
                  <strong>0 ha</strong> logged for all barangays. Highest is still{" "}
                  <strong>{topCal.name}</strong> at <strong>0.00 ha</strong> (tie).
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-800">Highest calamity damage:</span>{" "}
                  <strong>{topCal.name}</strong> at <strong>{topCal.calamityHa.toFixed(2)} ha</strong>
                  {rowsUnsorted.filter((r) => r.calamityHa > 0).length > 1
                    ? ` · ${rowsUnsorted.filter((r) => r.calamityHa === 0).length} barangay(ies) still at 0 ha`
                    : " · others at 0 ha"}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 border-t border-slate-100/80 pt-2">
            <Sprout size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>
              {insights.noRecords ? (
                <>
                  <span className="font-bold text-slate-800">Commodities:</span> no data —{" "}
                  <strong>0</strong> commodity types per barangay. Add records to see who leads in diversity and bags.
                </>
              ) : insights.allCommodityTypesZero ? (
                <>
                  <span className="font-bold text-slate-800">Commodity coverage:</span>{" "}
                  <strong>0</strong> distinct commodity types per barangay (all tied). Top by bags:{" "}
                  <strong>{topProd.name}</strong> at <strong>{topProd.production.toLocaleString()} bags</strong>.
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-800">Top commodity diversity:</span>{" "}
                  <strong>{topTypes.name}</strong> with <strong>{topTypes.commodityTypes}</strong>{" "}
                  type{topTypes.commodityTypes !== 1 ? "s" : ""}. Top production:{" "}
                  <strong>{topProd.name}</strong> at <strong>{topProd.production.toLocaleString()} bags</strong>
                  {topProd.name !== topTypes.name ? "." : " (same barangay)."}
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {data.map((b, i) => {
          const v = sortMetric(b, sortBy);
          const barWidth = maxVal > 0 ? Math.max(4, (v / maxVal) * 100) : 4;
          const rankColor = i < 3 ? RANK_COLORS[i] : "#cbd5e1";
          const isActive = typeof v === "number" && v > 0;
          const isHighlighted = barangayFilter && barangayFilter !== "All" && b.name === barangayFilter;

          return (
            <div
              key={b.name}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${
                isHighlighted ? "bg-emerald-50 ring-2 ring-emerald-400" : ""
              } ${isActive ? "hover:bg-white/50" : "opacity-70"}`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                style={{ background: rankColor }}
              >
                {i + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-xs font-bold text-slate-700">{b.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-xs font-black text-slate-600">{formatSortValue(b)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100/60">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${barWidth}%`,
                      background: i === 0 ? "#10b981" : i === 1 ? "#34d399" : i === 2 ? "#6ee7b7" : "#a7f3d0",
                    }}
                  />
                </div>
              </div>

              <div className="hidden shrink-0 gap-4 lg:flex">
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
                <div className="text-center">
                  <p className="font-mono text-xs font-bold text-amber-700">{b.calamityHa.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-slate-400">calam. ha</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-bold text-violet-700">{b.commodityTypes}</p>
                  <p className="text-[10px] font-bold text-slate-400">types</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
