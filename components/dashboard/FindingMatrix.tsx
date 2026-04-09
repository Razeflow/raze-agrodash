"use client";
import { useMemo, useState } from "react";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_OPTIONS, COMMODITY_COLORS, BARANGAYS } from "@/lib/data";
import { ChevronDown, Grid3X3, MapPin } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";

type StatusKey = "productive" | "atRisk" | "damaged" | "noActivity";

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; bg: string; barBg: string }> = {
  productive:  { label: "Productive",   color: "#16a34a", bg: "#ecfdf5", barBg: "#a7f3d0" },
  atRisk:      { label: "At Risk",      color: "#ea580c", bg: "#fff7ed", barBg: "#fed7aa" },
  damaged:     { label: "Damaged",      color: "#dc2626", bg: "#fef2f2", barBg: "#fecaca" },
  noActivity:  { label: "No Activity",  color: "#94a3b8", bg: "#f8fafc", barBg: "#e2e8f0" },
};

const STATUS_KEYS: StatusKey[] = ["productive", "atRisk", "damaged", "noActivity"];

type MatrixRow = {
  commodity: string;
  color: string;
  counts: Record<StatusKey, number>;
  total: number;
};

export default function FindingMatrix({ barangayFilter }: { barangayFilter?: string }) {
  const { records } = useAgriData();
  const [detailCommodity, setDetailCommodity] = useState<string | null>(null);

  const isFiltered = barangayFilter && barangayFilter !== "All";

  // Compute matrix data: for each commodity, count barangays by status
  const { matrixRows, totals, breakdowns } = useMemo(() => {
    const filtered = isFiltered ? records.filter((r) => r.barangay === barangayFilter) : records;
    const barangayList = isFiltered ? [barangayFilter!] : [...BARANGAYS];

    const rows: MatrixRow[] = COMMODITY_OPTIONS.map((commodity) => {
      const counts: Record<StatusKey, number> = { productive: 0, atRisk: 0, damaged: 0, noActivity: 0 };
      const breakdown: Record<StatusKey, string[]> = { productive: [], atRisk: [], damaged: [], noActivity: [] };

      barangayList.forEach((barangay) => {
        const brgyRecords = filtered.filter((r) => r.commodity === commodity && r.barangay === barangay);

        if (brgyRecords.length === 0) {
          counts.noActivity++;
          breakdown.noActivity.push(barangay);
          return;
        }

        const totalDamage = brgyRecords.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
        const totalArea = brgyRecords.reduce((s, r) => s + r.planting_area_hectares, 0);
        const damageRatio = totalArea > 0 ? totalDamage / totalArea : 0;

        if (damageRatio >= 0.5) {
          counts.damaged++;
          breakdown.damaged.push(barangay);
        } else if (totalDamage > 0) {
          counts.atRisk++;
          breakdown.atRisk.push(barangay);
        } else {
          counts.productive++;
          breakdown.productive.push(barangay);
        }
      });

      return {
        commodity,
        color: COMMODITY_COLORS[commodity] || "#6b7280",
        counts,
        total: barangayList.length,
      };
    });

    // Column totals
    const tots: Record<StatusKey, number> = { productive: 0, atRisk: 0, damaged: 0, noActivity: 0 };
    rows.forEach((r) => {
      STATUS_KEYS.forEach((k) => { tots[k] += r.counts[k]; });
    });

    // Breakdowns per commodity
    const brk: Record<string, Record<StatusKey, string[]>> = {};
    COMMODITY_OPTIONS.forEach((commodity) => {
      brk[commodity] = { productive: [], atRisk: [], damaged: [], noActivity: [] };
      barangayList.forEach((barangay) => {
        const brgyRecords = filtered.filter((r) => r.commodity === commodity && r.barangay === barangay);
        if (brgyRecords.length === 0) {
          brk[commodity].noActivity.push(barangay);
          return;
        }
        const totalDamage = brgyRecords.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
        const totalArea = brgyRecords.reduce((s, r) => s + r.planting_area_hectares, 0);
        const damageRatio = totalArea > 0 ? totalDamage / totalArea : 0;
        if (damageRatio >= 0.5) brk[commodity].damaged.push(barangay);
        else if (totalDamage > 0) brk[commodity].atRisk.push(barangay);
        else brk[commodity].productive.push(barangay);
      });
    });

    return { matrixRows: rows, totals: tots, breakdowns: brk };
  }, [records, isFiltered, barangayFilter]);

  // Find the max count for scaling bars
  const maxCount = useMemo(() => {
    let max = 1;
    matrixRows.forEach((r) => {
      STATUS_KEYS.forEach((k) => { if (r.counts[k] > max) max = r.counts[k]; });
    });
    return max;
  }, [matrixRows]);

  return (
    <BentoCard
      title="Finding Matrix"
      subtitle="Barangay status per commodity"
      icon={Grid3X3}
      collapsible
      defaultExpanded
      noPadding
    >
      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-8 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-44">
                Commodity
              </th>
              {STATUS_KEYS.map((key) => (
                <th key={key} className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {STATUS_CONFIG[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, i) => (
              <tr
                key={row.commodity}
                className="border-b border-slate-100/60 transition-colors hover:bg-slate-50/40 cursor-pointer"
                style={{ borderColor: i === matrixRows.length - 1 ? "transparent" : undefined }}
                onClick={() => setDetailCommodity(detailCommodity === row.commodity ? null : row.commodity)}
              >
                <td className="px-8 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                    <span className="text-sm font-bold text-slate-700">{row.commodity}</span>
                  </div>
                </td>
                {STATUS_KEYS.map((key) => (
                  <td key={key} className="px-3 py-3">
                    <CellBar
                      count={row.counts[key]}
                      max={maxCount}
                      status={key}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {/* Totals row */}
          <tfoot>
            <tr className="border-t-2 border-slate-100">
              <td className="px-8 py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total</span>
              </td>
              {STATUS_KEYS.map((key) => (
                <td key={key} className="px-3 py-3 text-center">
                  <span className="text-sm font-bold" style={{ color: STATUS_CONFIG[key].color }}>
                    {totals[key]}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detail Breakdown (collapsible per commodity) */}
      {detailCommodity && breakdowns[detailCommodity] && (
        <div className="bg-slate-50/50 rounded-b-[2.5rem] border-t border-slate-100 px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <ChevronDown size={14} className="text-slate-400" />
            <span className="h-2 w-2 rounded-full" style={{ background: COMMODITY_COLORS[detailCommodity] }} />
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {detailCommodity} — Barangay Breakdown
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_KEYS.map((key) => {
              const barangays = breakdowns[detailCommodity][key];
              return (
                <div
                  key={key}
                  className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: STATUS_CONFIG[key].color }}>
                      {STATUS_CONFIG[key].label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: STATUS_CONFIG[key].color }}>
                      {barangays.length}
                    </span>
                  </div>
                  {barangays.length > 0 ? (
                    <div className="space-y-1">
                      {barangays.map((b) => (
                        <div key={b} className="flex items-center gap-1.5">
                          <MapPin size={10} style={{ color: STATUS_CONFIG[key].color }} />
                          <span className="text-xs text-slate-600">{b}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 italic">None</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BentoCard>
  );
}

/** A single cell bar showing count + colored background scaled to max */
function CellBar({ count, max, status }: { count: number; max: number; status: StatusKey }) {
  const cfg = STATUS_CONFIG[status];
  const widthPct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 15 : 0) : 0;

  if (count === 0) {
    return (
      <div className="flex h-9 items-center justify-center rounded-2xl bg-slate-50/50">
        <span className="text-xs font-medium text-slate-300">—</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-9 items-center rounded-2xl overflow-hidden" style={{ background: cfg.bg }}>
      <div
        className="absolute inset-y-0 left-0 rounded-2xl transition-all duration-500"
        style={{ width: `${widthPct}%`, background: cfg.barBg }}
      />
      <span
        className="relative z-10 w-full text-center text-sm font-bold"
        style={{ color: cfg.color }}
      >
        {count}
      </span>
    </div>
  );
}
