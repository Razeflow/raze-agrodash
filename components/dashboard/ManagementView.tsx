"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { BARANGAYS, COMMODITY_COLORS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import { Users, Wheat, MapPin, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import RecordFormDialog from "./RecordFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import SeedButton from "./SeedButton";
import BentoCard from "@/components/ui/BentoCard";

function CommodityBadge({ name }: { name: string }) {
  const color = COMMODITY_COLORS[name] || "#888";
  return (
    <span className="inline-flex items-center rounded-[1rem] px-2.5 py-0.5 text-xs font-bold" style={{ background: color + "18", color }}>
      {name}
    </span>
  );
}

export default function ManagementView() {
  const { records, staleBarangays } = useAgriData();
  const [selected, setSelected] = useState<string>(BARANGAYS[0]);

  // CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editRecord, setEditRecord] = useState<AgriRecord | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgriRecord | null>(null);

  // Per-barangay stats
  const barangayStats = useMemo(() => {
    const stats: Record<string, { entries: number; farmers: number; production: number; area: number }> = {};
    BARANGAYS.forEach((b) => {
      stats[b] = { entries: 0, farmers: 0, production: 0, area: 0 };
    });
    records.forEach((r) => {
      if (stats[r.barangay]) {
        stats[r.barangay].entries++;
        stats[r.barangay].farmers += r.total_farmers;
        stats[r.barangay].production += r.harvesting_output_bags;
        stats[r.barangay].area += r.planting_area_hectares;
      }
    });
    return stats;
  }, [records]);

  const barangayRecords = useMemo(
    () => records.filter((r) => r.barangay === selected),
    [records, selected]
  );

  const stat = barangayStats[selected] || { entries: 0, farmers: 0, production: 0, area: 0 };

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
      <div className="grid gap-5 lg:grid-cols-4">
        {/* Left: Barangay list */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            10 Barangays
          </h2>
          {BARANGAYS.map((b) => {
            const s = barangayStats[b] || { entries: 0, farmers: 0, production: 0, area: 0 };
            const staleInfo = staleBarangays.find((sb) => sb.name === b);
            const isStale = staleInfo?.daysSinceUpdate !== null && staleInfo!.daysSinceUpdate! >= 7;
            const noData = staleInfo?.daysSinceUpdate === null;
            const isActive = selected === b;
            return (
              <button
                key={b}
                onClick={() => setSelected(b)}
                className={`w-full rounded-[2rem] border p-3 text-left transition-all backdrop-blur-xl ${
                  isActive
                    ? "bg-white/70 border-emerald-500 shadow-lg shadow-emerald-100/50"
                    : noData
                      ? "bg-white/70 border-red-200/60"
                      : isStale
                        ? "bg-white/70 border-orange-200/60"
                        : "bg-white/70 border-white/40 hover:shadow-md hover:shadow-slate-100/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold ${isActive ? "text-emerald-700" : "text-slate-700"}`}>
                    {b}
                  </p>
                  {noData && (
                    <span className="flex items-center gap-1 rounded-[1rem] bg-red-100/80 px-2 py-0.5 text-[10px] font-black text-red-600">
                      <AlertTriangle size={10} /> No Data
                    </span>
                  )}
                  {isStale && !noData && (
                    <span className="flex items-center gap-1 rounded-[1rem] bg-orange-100/80 px-2 py-0.5 text-[10px] font-black text-orange-500">
                      <AlertTriangle size={10} /> Stale
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-slate-400">
                  <span>{s.entries} entries</span>
                  <span>{s.farmers} farmers</span>
                  {staleInfo?.lastUpdate && <span>last: {staleInfo.lastUpdate}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected barangay detail */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header + stats */}
          <BentoCard noPadding>
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{selected}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Barangay commodity data management</p>
                </div>
                <div className="flex items-center gap-2">
                  <SeedButton />
                  <button
                    onClick={openAdd}
                    className="flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-200 transition"
                  >
                    <Plus size={16} /> Add Entry
                  </button>
                </div>
              </div>

              {/* Mini KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/50 backdrop-blur border border-emerald-100/50 p-3">
                  <Users size={18} className="text-emerald-600" />
                  <div>
                    <p className="font-mono text-lg font-bold text-emerald-700">{stat.farmers.toLocaleString()}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Farmers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-amber-50/50 backdrop-blur border border-amber-100/50 p-3">
                  <Wheat size={18} className="text-amber-600" />
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-700">{stat.production.toLocaleString()}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bags (40kg)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-blue-50/50 backdrop-blur border border-blue-100/50 p-3">
                  <MapPin size={18} className="text-blue-600" />
                  <div>
                    <p className="font-mono text-lg font-bold text-blue-700">{stat.area.toFixed(1)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hectares</p>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Records table */}
          <BentoCard noPadding>
            <div className="px-8 pt-8 pb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Commodity Records
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{barangayRecords.length} entries for {selected}</p>
            </div>

            {barangayRecords.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-400">No records yet for {selected}.</p>
                <button onClick={openAdd} className="mt-3 text-sm font-black text-emerald-600 hover:underline">
                  + Add first entry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/30 backdrop-blur">
                      {["Commodity", "Variety", "Male", "Female", "Total", "Area (ha)", "Harvest", "Damage", "Pests", "Calamity", ""].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/30">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barangayRecords.map((r, i) => {
                      const totalDmg = +(r.damage_pests_hectares + r.damage_calamity_hectares).toFixed(2);
                      return (
                        <tr key={r.id} className={`transition-colors hover:bg-emerald-50/30 ${i % 2 === 0 ? "bg-white/40" : "bg-transparent"}`}>
                          <td className="px-3 py-2.5 whitespace-nowrap"><CommodityBadge name={r.commodity} /></td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{r.sub_category}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-blue-600 text-right">{r.farmer_male}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-pink-500 text-right">{r.farmer_female}</td>
                          <td className="px-3 py-2.5 text-xs font-mono font-bold text-slate-700 text-right">{r.total_farmers}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-slate-600 text-right">
                            {r.commodity === "Fishery" ? "—" : r.planting_area_hectares}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono font-semibold text-emerald-600 text-right">
                            {r.commodity === "Fishery" ? "—" : r.harvesting_output_bags.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-right">
                            {totalDmg > 0 ? <span className="text-red-500">{totalDmg} ha</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[140px]">
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
            )}
          </BentoCard>
        </div>
      </div>

      {/* Dialogs */}
      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} defaultBarangay={selected} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
