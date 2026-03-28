"use client";
import { useState, useMemo } from "react";
import { useAgriData } from "@/lib/agri-context";
import { BARANGAYS, COMMODITY_COLORS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import { Users, Wheat, MapPin, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import RecordFormDialog from "./RecordFormDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import SeedButton from "./SeedButton";

function CommodityBadge({ name }: { name: string }) {
  const color = COMMODITY_COLORS[name] || "#888";
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: color + "18", color }}>
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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
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
                className="w-full rounded-xl border p-3 text-left transition-all"
                style={
                  isActive
                    ? { background: "#f0faf0", borderColor: "#16a34a", boxShadow: "0 0 0 1px #16a34a33" }
                    : noData
                      ? { background: "#fff", borderColor: "#fecaca" }
                      : isStale
                        ? { background: "#fff", borderColor: "#fed7aa" }
                        : { background: "#fff", borderColor: "#e5e7eb" }
                }
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold ${isActive ? "text-green-700" : "text-gray-700"}`}>
                    {b}
                  </p>
                  {noData && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      <AlertTriangle size={10} /> No Data
                    </span>
                  )}
                  {isStale && !noData && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-500">
                      <AlertTriangle size={10} /> Stale
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-gray-400">
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
          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selected}</h2>
                <p className="text-xs text-gray-400">Barangay commodity data management</p>
              </div>
              <div className="flex items-center gap-2">
                <SeedButton />
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                >
                  <Plus size={16} /> Add Entry
                </button>
              </div>
            </div>

            {/* Mini KPI row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3">
                <Users size={18} className="text-green-600" />
                <div>
                  <p className="font-mono text-lg font-bold text-green-700">{stat.farmers.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Farmers</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-yellow-50 p-3">
                <Wheat size={18} className="text-yellow-600" />
                <div>
                  <p className="font-mono text-lg font-bold text-yellow-700">{stat.production.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Bags (40kg)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
                <MapPin size={18} className="text-blue-600" />
                <div>
                  <p className="font-mono text-lg font-bold text-blue-700">{stat.area.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Hectares</p>
                </div>
              </div>
            </div>
          </div>

          {/* Records table */}
          <div className="rounded-2xl border border-green-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                Commodity Records
              </h3>
              <p className="text-xs text-gray-400">{barangayRecords.length} entries for {selected}</p>
            </div>

            {barangayRecords.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-gray-400">No records yet for {selected}.</p>
                <button onClick={openAdd} className="mt-3 text-sm font-semibold text-green-600 hover:underline">
                  + Add first entry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {["Commodity", "Variety", "Male", "Female", "Total", "Area (ha)", "Harvest", "Damage", "Pests", "Calamity", ""].map((h) => (
                        <th key={h} className="whitespace-nowrap bg-gray-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barangayRecords.map((r, i) => {
                      const totalDmg = +(r.damage_pests_hectares + r.damage_calamity_hectares).toFixed(2);
                      return (
                        <tr key={r.id} className={`border-b border-gray-50 transition-colors hover:bg-green-50/40 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-3 py-2.5 whitespace-nowrap"><CommodityBadge name={r.commodity} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{r.sub_category}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-blue-600 text-right">{r.farmer_male}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-pink-500 text-right">{r.farmer_female}</td>
                          <td className="px-3 py-2.5 text-xs font-mono font-bold text-gray-700 text-right">{r.total_farmers}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-600 text-right">
                            {r.commodity === "Fishery" ? "—" : r.planting_area_hectares}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono font-semibold text-green-600 text-right">
                            {r.commodity === "Fishery" ? "—" : r.harvesting_output_bags.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-right">
                            {totalDmg > 0 ? <span className="text-red-500">{totalDmg} ha</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[140px]">
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
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <RecordFormDialog open={formOpen} onClose={() => setFormOpen(false)} mode={formMode} initialData={editRecord} defaultBarangay={selected} />
      <DeleteConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} record={deleteTarget} />
    </>
  );
}
