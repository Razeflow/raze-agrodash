"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import {
  COMMODITY_COLORS,
  formatPeriod,
  formatDatePH,
  MONTH_NAMES,
  BARANGAYS,
  CALAMITY_SUB_CATEGORY_LABELS,
} from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import {
  Search, Filter, Plus, Pencil, Trash2, CalendarDays, MapPin, Calendar, X,
  Table2, Wheat, BarChart3,
} from "lucide-react";
import RecordFormDialog from "./RecordFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import BentoCard from "@/components/ui/BentoCard";

const COMMODITIES = ["All", "Rice", "Corn", "Fishery", "High Value Crops", "Industrial Crops"];

function CommodityBadge({ name }: { name: string }) {
  const color = COMMODITY_COLORS[name] || "#888";
  return (
    <span
      className="inline-flex items-center rounded-[1rem] px-2.5 py-0.5 text-xs font-bold"
      style={{ background: color + "18", color }}
    >
      {name}
    </span>
  );
}

function RiskChip({ area }: { area: number }) {
  if (area >= 2) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{area} ha ⚠</span>;
  if (area >= 1) return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-500">{area} ha</span>;
  if (area > 0) return <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] text-yellow-600">{area} ha</span>;
  return null;
}

export default function DataTable() {
  const { records } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();

  // ── Filters ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [periodFilter, setPeriodFilter] = useState("All");
  const [barangayFilter, setBarangayFilter] = useState(
    isBarangayUser && userBarangay ? userBarangay : "All",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  // ── CRUD state ───────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editRecord, setEditRecord] = useState<AgriRecord | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgriRecord | null>(null);

  // ── Period filter options (derived from data) ───────────────────────
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

  // ── Filtered records ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T00:00:00").getTime() + 24 * 60 * 60 * 1000 : null;
    return records.filter((r) => {
      if (filter !== "All" && r.commodity !== filter) return false;
      if (barangayFilter !== "All" && r.barangay !== barangayFilter) return false;
      if (periodFilter !== "All") {
        if (r.period_month == null || r.period_year == null) return false;
        const key = `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;
        if (key !== periodFilter) return false;
      }
      const created = new Date(r.created_at).getTime();
      if (fromTs !== null && created < fromTs) return false;
      if (toTs !== null && created >= toTs) return false;
      const q = search.toLowerCase();
      if (q) {
        const hay =
          r.barangay.toLowerCase() +
          " " + r.commodity.toLowerCase() +
          " " + r.sub_category.toLowerCase() +
          " " + r.pests_diseases.toLowerCase() +
          " " + r.calamity.toLowerCase() +
          " " + r.calamity_sub_category.toLowerCase() +
          " " + (CALAMITY_SUB_CATEGORY_LABELS[r.calamity_sub_category] || "").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filter, barangayFilter, periodFilter, dateFrom, dateTo, search]);

  // ── KPI strip (driven by filtered set) ──────────────────────────────
  const kpis = useMemo(() => {
    const totalRecords = filtered.length;
    const totalArea = filtered
      .filter((r) => r.commodity !== "Fishery")
      .reduce((s, r) => s + (r.planting_area_hectares || 0), 0);
    const byCommodity = new Map<string, number>();
    for (const r of filtered) {
      if (r.commodity === "Fishery") continue;
      byCommodity.set(r.commodity, (byCommodity.get(r.commodity) ?? 0) + (r.planting_area_hectares || 0));
    }
    const top = [...byCommodity.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      totalRecords,
      totalArea: +totalArea.toFixed(1),
      topCommodity: top?.[0] ?? "—",
      topArea: top ? +top[1].toFixed(1) : 0,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const hasActiveFilter =
    search || filter !== "All" || periodFilter !== "All" ||
    (!isBarangayUser && barangayFilter !== "All") ||
    dateFrom || dateTo;

  function clearFilters() {
    setSearch("");
    setFilter("All");
    setPeriodFilter("All");
    setBarangayFilter(isBarangayUser && userBarangay ? userBarangay : "All");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function openAdd() { setFormMode("add"); setEditRecord(undefined); setFormOpen(true); }
  function openEdit(r: AgriRecord) { setFormMode("edit"); setEditRecord(r); setFormOpen(true); }
  function openDelete(r: AgriRecord) { setDeleteTarget(r); setDeleteOpen(true); }

  return (
    <>
      <div className="fade-up delay-1 space-y-5">
        {/* ── Header bar ───────────────────────────────────────────── */}
        <BentoCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Agricultural Records
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                {hasActiveFilter ? <span className="text-slate-300"> · filtered</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-8 w-52 rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Search barangay, crop, pest..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              {/* Commodity */}
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
              {/* Barangay (admin only) */}
              {!isBarangayUser && (
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
              )}
              {/* Period */}
              <div className="relative">
                <CalendarDays size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  className="h-8 appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur pl-8 pr-6 text-[10px] font-black uppercase text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={periodFilter}
                  onChange={(e) => { setPeriodFilter(e.target.value); setPage(1); }}
                  title="Filter by reporting period"
                >
                  <option value="All">All Periods</option>
                  {periodOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              {/* Created date range */}
              <div className="flex items-center gap-2 h-8 rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-3">
                <Calendar size={12} className="text-emerald-600 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                  Date
                </span>
                <input
                  type="date"
                  aria-label="Created on or after"
                  title="From date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none w-[110px] [color-scheme:light]"
                />
                <span className="text-slate-300 shrink-0">→</span>
                <input
                  type="date"
                  aria-label="Created on or before"
                  title="To date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none w-[110px] [color-scheme:light]"
                />
              </div>
              {/* Clear filters */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-8 items-center gap-1 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 transition"
                  title="Clear all filters"
                >
                  <X size={12} /> Clear
                </button>
              )}
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-200 transition"
              >
                <Plus size={14} /> Add Record
              </button>
            </div>
          </div>
        </BentoCard>

        {/* ── Records Analytics (collapsible) ──────────────────────── */}
        <BentoCard
          title="Records Analytics"
          subtitle="Filtered totals & top commodity"
          icon={BarChart3}
          collapsible
          defaultExpanded={false}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/50 backdrop-blur border border-emerald-100/50 p-4">
              <Table2 size={20} className="text-emerald-600" />
              <div>
                <p className="font-mono text-2xl font-black text-emerald-700">{kpis.totalRecords.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Records (filtered)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50/50 backdrop-blur border border-amber-100/50 p-4">
              <Wheat size={20} className="text-amber-600" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CommodityBadge name={kpis.topCommodity} />
                  <span className="font-mono text-sm font-black text-amber-700">{kpis.topArea} ha</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Top commodity by area</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50/50 backdrop-blur border border-blue-100/50 p-4">
              <MapPin size={20} className="text-blue-600" />
              <div>
                <p className="font-mono text-2xl font-black text-blue-700">{kpis.totalArea.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total area (ha)</p>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* ── Compact record cards ────────────────────────────────── */}
        {filtered.length === 0 ? (
          <BentoCard>
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">
                No records match your filters. {hasActiveFilter ? (
                  <button onClick={clearFilters} className="font-bold text-emerald-600 hover:underline">Clear filters</button>
                ) : (
                  <button onClick={openAdd} className="font-bold text-emerald-600 hover:underline">Add the first record</button>
                )}
              </p>
            </div>
          </BentoCard>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map((r) => {
                const totalDmg = +(r.damage_pests_hectares + r.damage_calamity_hectares).toFixed(2);
                const isFishery = r.commodity === "Fishery";
                const hasIssues = r.pests_diseases !== "None" || r.calamity_sub_category !== "None";
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 hover:border-emerald-200 hover:bg-emerald-50/30 p-3 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                      {/* Zone 1: identity */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CommodityBadge name={r.commodity} />
                          <span className="text-sm font-semibold text-slate-700 truncate">{r.barangay}</span>
                          {r.sub_category && (
                            <span className="text-xs text-slate-500 truncate">· {r.sub_category}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                          <CalendarDays size={11} />
                          <span>{formatPeriod(r.period_month, r.period_year)}</span>
                          <span className="text-slate-300">·</span>
                          <span>created {formatDatePH(r.created_at, { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </div>

                      {/* Zone 2: farmer counts */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="flex items-center gap-1.5 rounded-xl bg-blue-50/60 px-2 py-1">
                          <span className="font-mono text-xs font-bold text-blue-600">{r.farmer_male}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">M</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-xl bg-pink-50/60 px-2 py-1">
                          <span className="font-mono text-xs font-bold text-pink-500">{r.farmer_female}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">F</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/70 px-2 py-1">
                          <span className="font-mono text-xs font-bold text-slate-700">{r.total_farmers}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">T</span>
                        </div>
                      </div>

                      {/* Zone 3: production numbers */}
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        {isFishery ? (
                          <>
                            <div className="text-right">
                              <p className="font-mono font-bold text-cyan-600">{r.stocking.toLocaleString()}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stock</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold text-emerald-600">{r.harvesting_fishery.toLocaleString()}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Harvest</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-right">
                              <p className="font-mono font-bold text-slate-700">{r.planting_area_hectares}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Area</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold text-emerald-600">{r.harvesting_output_bags.toLocaleString()}</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bags</p>
                            </div>
                          </>
                        )}
                        {totalDmg > 0 && <RiskChip area={totalDmg} />}
                      </div>

                      {/* Zone 4: actions */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-blue-50/50 hover:text-blue-500 transition"
                          title="Edit record"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => openDelete(r)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50/50 hover:text-red-500 transition"
                          title="Delete record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Issue strip (only if pests/calamity present) */}
                    {hasIssues && (
                      <div className="mt-2 pt-2 border-t border-white/40 flex items-center gap-2 flex-wrap text-[11px]">
                        {r.pests_diseases !== "None" && (
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">
                            🐛 {r.pests_diseases}
                          </span>
                        )}
                        {r.calamity_sub_category !== "None" && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                            ⛈ {CALAMITY_SUB_CATEGORY_LABELS[r.calamity_sub_category]}
                            {r.calamity && r.calamity !== "None" ? ` — ${r.calamity}` : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between rounded-2xl bg-white/50 backdrop-blur border border-white/30 px-4 py-3">
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
            )}
          </>
        )}
      </div>

      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
