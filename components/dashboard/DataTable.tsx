"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import { Search, Filter, Plus, Pencil, Trash2 } from "lucide-react";
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
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  // CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editRecord, setEditRecord] = useState<AgriRecord | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgriRecord | null>(null);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchCom = filter === "All" || r.commodity === filter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.barangay.toLowerCase().includes(q) ||
        r.commodity.toLowerCase().includes(q) ||
        r.sub_category.toLowerCase().includes(q) ||
        r.pests_diseases.toLowerCase().includes(q) ||
        r.calamity.toLowerCase().includes(q);
      return matchCom && matchSearch;
    });
  }, [records, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function openAdd() {
    setFormMode("add");
    setEditRecord(undefined);
    setFormOpen(true);
  }

  function openEdit(r: AgriRecord) {
    setFormMode("edit");
    setEditRecord(r);
    setFormOpen(true);
  }

  function openDelete(r: AgriRecord) {
    setDeleteTarget(r);
    setDeleteOpen(true);
  }

  return (
    <>
      <div className="fade-up delay-1 rounded-2xl border border-green-100 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Agricultural Records
            </h2>
            <p className="text-xs text-gray-400">{filtered.length} records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="h-8 rounded-full border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-green-400 focus:bg-white transition"
                placeholder="Search barangay, crop, pest..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {/* Filter */}
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="h-8 appearance-none rounded-full border border-gray-200 bg-gray-50 pl-8 pr-6 text-xs text-gray-700 outline-none focus:border-green-400 focus:bg-white transition"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              >
                {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Add button */}
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
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
                    {["Barangay","Commodity","Sub-category","Male","Female","Total","Area (ha)","Harvest (bags)","Damage (ha)","Pests / Diseases","Calamity",""].map((h) => (
                      <th key={h} className="whitespace-nowrap bg-gray-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
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
                        className={`border-b border-gray-50 transition-colors hover:bg-green-50/40 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      >
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700 whitespace-nowrap">{r.barangay}</td>
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
            <div className="flex items-center justify-between border-t border-gray-50 px-5 py-3">
              <span className="text-xs text-gray-400">
                Page {page} of {totalPages} · {filtered.length} records
              </span>
              <div className="flex gap-1.5">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 transition hover:bg-green-50 disabled:opacity-30">
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="rounded-lg border px-3 py-1 text-xs transition"
                      style={p === page ? { background: "#16a34a", color: "#fff", borderColor: "#16a34a" } : { borderColor: "#e5e7eb", color: "#6b7280" }}
                    >
                      {p}
                    </button>
                  ))}
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 transition hover:bg-green-50 disabled:opacity-30">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
