"use client";
import { useState, useMemo } from "react";
import { X, Search, UserCheck } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";

type Props = {
  open: boolean;
  onClose: () => void;
  barangay: string;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export default function FarmerSelectDialog({ open, onClose, barangay, selectedIds, onConfirm }: Props) {
  const { farmers } = useAgriData();
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  // Reset on open
  useState(() => { if (open) setChecked(new Set(selectedIds)); });

  const filtered = useMemo(() => {
    return farmers
      .filter((f) => f.barangay === barangay)
      .filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  }, [farmers, barangay, search]);

  const allFarmersForBarangay = useMemo(() => farmers.filter((f) => f.barangay === barangay), [farmers, barangay]);

  if (!open) return null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(checked));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-green-100">
              <UserCheck size={18} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Select Farmers</h2>
          </div>
          <button onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <p className="mb-3 text-xs text-gray-400">
          Showing farmers registered in <span className="font-semibold text-gray-600">{barangay}</span> ({allFarmersForBarangay.length} total)
        </p>

        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full h-8 rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition"
            placeholder="Search farmers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {allFarmersForBarangay.length === 0
                ? "No farmers registered for this barangay yet."
                : "No matching farmers found."}
            </p>
          ) : (
            filtered.map((f) => (
              <label
                key={f.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition ${checked.has(f.id) ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}
              >
                <input
                  type="checkbox"
                  checked={checked.has(f.id)}
                  onChange={() => toggle(f.id)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{f.name}</p>
                  <p className="text-xs text-gray-400">{f.gender}</p>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{checked.size} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition">Cancel</button>
            <button onClick={handleConfirm} className="rounded-[1.5rem] bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
