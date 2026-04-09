"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS, formatPeriod, MONTH_NAMES, BARANGAYS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import { Search, Filter, Plus, Pencil, Trash2, CalendarDays, MapPin } from "lucide-react";
import RecordFormDialog from "./RecordFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import BentoCard from "@/components/ui/BentoCard";

const COMMODITIES = ["All", "Rice", "Corn", "Fishery", "High Value Crops", "Industrial Crops"];

function CommodityBadge({ name }: { name: string }) {
  const color = COMMODITY_COLORS[name] || "#888";
  return (
    <span className="inline-flex items-center rounded-[1rem] px-2.5 py-0.5 text-xs font-bold" style={{ background: color + "18", color }}>
      {name}
    </span>
  );
}

function RiskChip({ area }: { area: number }) {
  if (area >= 2) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">{area} ha ⚠</span>;
  if (area >= 1) return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-500">{area} ha</span>;
  if (area > 0) return <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-600">{area} ha</span>;
  return <span className="text-xs text-gray-300">—</span>;
}

export default function DataTable() {
  const { records } = useAgriData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [periodFilter, setPeriodFilter] = useState(() => {
    const now = new Date();
    const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    return `${ph.getFullYear()}-${String(ph.getMonth() + 1).padStart(2, "0")}`;
  });
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  // CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editRecord, setEditRecord] = useState<AgriRecord | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgriRecord | null>(null);

  // Period filter options
  const periodOptions = useMemo(() => {
    const seen = new Map<string, { month: number; year: number }>();
    for (const r of records) {
      if (r.period_month != null && r.period_year != null) {
        const key = `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;
        if (!seen.has(key)) seen.set(key, { month: r.period_month, year: r.period_year });
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, { month, year }]) => ({
        key, label: `${MONTH_NAMES[month - 1]} ${year}`, month, year,
      }));
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchCom = filter === "All" || r.commodity === filter;
      const matchBarangay = barangayFilter === "All" || r.barangay === barangayFilter;
      const matchPeriod = periodFilter === "All" || (
        r.period_month != null && r.period_year != null &&
        periodFilter === `${r.period_year}-${String(r.period_month).padStart(2, "0")}`
      );
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.barangay.toLowerCase().includes(q) ||
        r.commodity.toLowerCase().includes(q) ||
        r.sub_category.toLowerCase().includes(q) ||
        r.pests_diseases.toLowerCase().includes(q) ||
        r.calamity.toLowerCase().includes(q);
      return matchCom && matchBarangay && matchPeriod && matchSearch;
    });
  }, [records, search, filter, barangayFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function openAdd() { setFormMode("add"); setEditRecord(undefined); setFormOpen(true); }
  function openEdit(r: AgriRecord) { setFormMode("edit"); setEditRecord(r); setFormOpen(true); }
  function openDelete(r: AgriRecord) { setDeleteTarget(r); setDeleteOpen(true); }

  return (
    <>
      <BentoCard noPadding className="fade-up delay-1">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-8 pt-8 pb-4">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Agricultural Records
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Search barangay, crop, pest..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {/* Commodity filter */}
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className="h-8 appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur pl-8 pr-6 text-[10px] font-black uppercase text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              >
                {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Barangay filter */}
            <div className="relative">
              <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className="h-8 appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur pl-8 pr-6 text-[10px] font-black uppercase text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={barangayFilter}
                onChange={(e) => { setBarangayFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Barangays</option>
                {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {/* Period filter */}
            <div className="relative">
              <CalendarDays size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className="h-8 appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur pl-8 pr-6 text-[10px] font-black uppercase text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={periodFilter}
                onChange={(e) => { setPeriodFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Periods</option>
                {periodOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-200 transition"
            >
              <Plus size={14} /> Add Record
            </button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-400">No records found. Click &quot;Add Record&quot; to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/30 backdrop-blur">
                    {["Barangay","Period","Commodity","Sub-category","Male","Female","Total","Area (ha)","Harvest (bags)","Damage (ha)","Pests / Diseases","Calamity",""].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/30"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => {
                    const totalDmg = +(r.damage_pests_hectares + r.damage_calamity_hectares).toFixed(2);
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors hover:bg-emerald-50/30 ${i % 2 === 0 ? "bg-white/40" : "bg-transparent"}`}
                      >
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{r.barangay}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {formatPeriod(r.period_month, r.period_year)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><CommodityBadge name={r.commodity} /></td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.sub_category}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-blue-600 text-right">{r.farmer_male}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-pink-500 text-right">{r.farmer_female}</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-bold text-slate-700 text-right">{r.total_farmers}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-600 text-right">
                          {r.commodity === "Fishery" ? <span className="text-slate-300">—</span> : r.planting_area_hectares}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-semibold text-emerald-600 text-right">
                          {r.commodity === "Fishery" ? <span className="text-slate-300">—</span> : r.harvesting_output_bags.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right"><RiskChip area={totalDmg} /></td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[160px]">
                          {r.pests_diseases === "None" ? <span className="text-slate-300">—</span> : r.pests_diseases}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {r.calamity === "None" ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">{r.calamity}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(r)} className="rounded-xl p-1.5 text-slate-400 hover:bg-blue-50/50 hover:text-blue-500 transition" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => openDelete(r)} className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50/50 hover:text-red-500 transition" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-white/30 px-8 py-4">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} · {filtered.length} records
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-3 py-1 text-xs text-slate-500 transition disabled:opacity-30 hover:bg-white/70"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded-[1.5rem] border px-3 py-1 text-xs transition ${
                        p === page
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                          : "border-white/40 bg-white/50 backdrop-blur text-slate-500 hover:bg-white/70"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-3 py-1 text-xs text-slate-500 transition disabled:opacity-30 hover:bg-white/70"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </BentoCard>

      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
