"use client";

/**
 * Phase C — Land Allocation panel.
 *
 * Per-asset view of LAND (planting_area) utilisation. Reads farmer_assets +
 * agri_records from AgriDataContext and computes total / utilized / remaining
 * hectares in memory using the same allocation helpers the form validates with
 * (lib/domain/allocation.ts). The numbers therefore match the form's live
 * "Remaining: X ha" hint exactly.
 *
 * Optionally we could read the v_land_asset_allocation Postgres view instead,
 * but the data is already in memory and computing here keeps the panel reactive
 * to in-flight mutations without an extra round trip.
 */

import { useMemo, useState } from "react";
import { Layers, AlertCircle, MapPin } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { BARANGAYS } from "@/lib/data";
import { sortBy } from "@/lib/sort";
import {
  calculateRemainingLandAssetHa,
  sumActiveLandAssetAllocationHa,
} from "@/lib/domain/allocation";
import BentoCard from "@/components/ui/BentoCard";

type Row = {
  assetId: string;
  parcelLabel: string;
  farmerName: string;
  barangay: string;
  totalHa: number;
  utilizedHa: number;
  remainingHa: number;
  activeCount: number;
  pctUsed: number; // 0..100
};

export default function LandAllocation() {
  const { farmerAssets, records, farmers } = useAgriData();
  const { isBarangayUser, userBarangay, isAdminOrAbove } = useAuth();

  const [barangayFilter, setBarangayFilter] = useState<string>(
    isBarangayUser && userBarangay ? userBarangay : "All",
  );
  const [search, setSearch] = useState("");

  const sortedBarangays = useMemo(() => sortBy([...BARANGAYS], (b) => b), []);

  const rows: Row[] = useMemo(() => {
    const farmerById = new Map(farmers.map((f) => [f.id, f] as const));
    return farmerAssets
      .filter((a) => a.category === "planting_area")
      .map((a) => {
        const farmer = farmerById.get(a.farmer_id);
        const totalHa = Number(a.area_hectares ?? 0);
        const utilizedHa = sumActiveLandAssetAllocationHa(a.id, records);
        const remainingHa = calculateRemainingLandAssetHa(a, records);
        const activeCount = records.filter(
          (r) => r.farmer_asset_id === a.id && r.status === "active",
        ).length;
        return {
          assetId: a.id,
          parcelLabel: a.parcel_label?.trim() || `Lot ${a.id.slice(0, 8)}`,
          farmerName: farmer?.name ?? "(unlinked farmer)",
          barangay: farmer?.barangay ?? "",
          totalHa,
          utilizedHa,
          remainingHa,
          activeCount,
          pctUsed: totalHa > 0 ? Math.min(100, (utilizedHa / totalHa) * 100) : 0,
        };
      });
  }, [farmerAssets, records, farmers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (barangayFilter === "All" ? true : r.barangay === barangayFilter))
      .filter((r) =>
        q
          ? r.parcelLabel.toLowerCase().includes(q) || r.farmerName.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.pctUsed - a.pctUsed || a.farmerName.localeCompare(b.farmerName));
  }, [rows, barangayFilter, search]);

  const totals = useMemo(() => {
    const t = filtered.reduce(
      (acc, r) => {
        acc.totalHa += r.totalHa;
        acc.utilizedHa += r.utilizedHa;
        acc.remainingHa += r.remainingHa;
        acc.activeCount += r.activeCount;
        return acc;
      },
      { totalHa: 0, utilizedHa: 0, remainingHa: 0, activeCount: 0 },
    );
    return t;
  }, [filtered]);

  return (
    <BentoCard
      icon={Layers}
      title="Land Allocation"
      subtitle="Per-lot utilisation of active CROP cycles"
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {isAdminOrAbove && (
          <div className="flex items-center gap-2 rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-3 py-1.5">
            <MapPin size={14} className="text-emerald-600" />
            <select
              className="appearance-none bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer"
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
            >
              <option value="All">All Barangays</option>
              {sortedBarangays.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by lot or farmer…"
          className="flex-1 min-w-[200px] rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-4 py-1.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
      </div>

      {/* Summary line */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <SummaryStat label="Lots" value={filtered.length.toString()} />
        <SummaryStat label="Total" value={`${totals.totalHa.toFixed(2)} ha`} />
        <SummaryStat label="Utilized" value={`${totals.utilizedHa.toFixed(2)} ha`} tone="emerald" />
        <SummaryStat label="Remaining" value={`${totals.remainingHa.toFixed(2)} ha`} tone="slate" />
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-3 text-slate-300" />
          No planting-area assets match your filters. Add one under Farmers → Assets, then come back.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.assetId}
              className="rounded-[1.5rem] border border-white/40 bg-white/60 backdrop-blur px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-black text-slate-900 text-sm tracking-tight">
                    {r.parcelLabel}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500">
                    {r.farmerName}
                    {r.barangay ? ` · ${r.barangay}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    {r.activeCount} active cycle{r.activeCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    <span className={r.remainingHa < 0 ? "text-red-600" : "text-emerald-700"}>
                      {r.remainingHa.toFixed(2)} ha remaining
                    </span>
                    {" "}of {r.totalHa.toFixed(2)} ha
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    r.pctUsed > 100 ? "bg-red-500" : r.pctUsed > 85 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, r.pctUsed)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 font-bold">
                {r.pctUsed.toFixed(0)}% utilised
              </p>
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}

function SummaryStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald";
}) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/50 backdrop-blur px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{label}</p>
      <p
        className={`text-sm font-black tracking-tight mt-0.5 ${
          tone === "emerald" ? "text-emerald-700" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
