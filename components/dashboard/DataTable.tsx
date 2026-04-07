"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS, formatPeriod, MONTH_NAMES, BARANGAYS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import { Search, Filter, Plus, Pencil, Trash2, CalendarDays, MapPin } from "lucide-react";
import RecordFormDialog from "./RecordFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

const COMMODITIES = ["All", "Rice", "Corn", "Fishery", "High Value Crops", "Industrial Crops"];

function CommodityBadge({ name }: { name: string }) {
  const color = COMMODITY_COLORS[name] || "#888";
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: color + "18", color }}>
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
      <div className="fade-up delay-1 ui-card ui-card--shadow">
        {/* Header */}
        <div className="ui-card-header flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-soft)" }}>
              Agricultural Records
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{filtered.length} records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="ui-input h-8 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 transition"
                placeholder="Search barangay, crop, pest..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {/* Commodity filter */}
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="ui-input h-8 appearance-none pl-8 pr-6 text-xs text-gray-700 transition"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              >
                {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Barangay filter */}
            <div className="relative">
              <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="ui-input h-8 appearance-none pl-8 pr-6 text-xs text-gray-700 transition"
                value={barangayFilter}
                onChange={(e) => { setBarangayFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Barangays</option>
                {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {/* Period filter */}
            <div className="relative">
              <CalendarDays size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="ui-input h-8 appearance-none pl-8 pr-6 text-xs text-gray-700 transition"
                value={periodFilter}
                onChange={(e) => { setPeriodFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Periods</option>
                {periodOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition"
              style={{ background: "var(--accent-blue)" }}
            >
              <Plus size={14} /> Add Record
            </button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">No records found. Click &quot;Add Record&quot; to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    {["Barangay","Period","Commodity","Sub-category","Male","Female","Total","Area (ha)","Harvest (bags)","Damage (ha)","Pests / Diseases","Calamity",""].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border-b"
                        style={{ background: "var(--surface-2)", color: "var(--text-soft)", borderColor: "var(--border)" }}
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
                        className={`transition-colors ${i % 2 === 0 ? "bg-white" : ""}`}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 === 0 ? "var(--surface)" : "color-mix(in oklab, var(--surface) 92%, var(--surface-2))",
                        }}
                      >
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700 whitespace-nowrap">{r.barangay}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {formatPeriod(r.period_month, r.period_year)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><CommodityBadge name={r.commodity} /></td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.sub_category}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-blue-600 text-right">{r.farmer_male}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-pink-500 text-right">{r.farmer_female}</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-bold text-gray-700 text-right">{r.total_farmers}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-gray-600 text-right">
                          {r.commodity === "Fishery" ? <span className="text-gray-300">—</span> : r.planting_area_hectares}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono font-semibold text-green-600 text-right">
                          {r.commodity === "Fishery" ? <span className="text-gray-300">—</span> : r.harvesting_output_bags.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right"><RiskChip area={totalDmg} /></td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px]">
                          {r.pests_diseases === "None" ? <span className="text-gray-300">—</span> : r.pests_diseases}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {r.calamity === "None" ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">{r.calamity}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => openDelete(r)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition" title="Delete">
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
            <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs text-gray-400">
                Page {page} of {totalPages} · {filtered.length} records
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-xs text-gray-500 transition disabled:opacity-30"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="rounded-lg border px-3 py-1 text-xs transition"
                      style={
                        p === page
                          ? { background: "var(--accent-blue)", color: "#fff", borderColor: "var(--accent-blue)" }
                          : { borderColor: "var(--border)", color: "#6b7280", background: "var(--surface)" }
                      }
                    >
                      {p}
                    </button>
                  ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-xs text-gray-500 transition disabled:opacity-30"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
