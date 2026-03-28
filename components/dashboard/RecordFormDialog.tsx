"use client";
import { useState, useEffect } from "react";
import { X, Users, CheckCircle2 } from "lucide-react";
import type { AgriRecord } from "@/lib/data";
import { BARANGAYS, COMMODITY_OPTIONS, SUB_TYPES } from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import FarmerSelectDialog from "./FarmerSelectDialog";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initialData?: AgriRecord;
  defaultBarangay?: string;
};

const emptyForm = {
  barangay: BARANGAYS[0] as string,
  commodity: "Rice" as AgriRecord["commodity"],
  sub_category: "Hybrid",
  farmer_ids: [] as string[],
  planting_area_hectares: 0,
  harvesting_output_bags: 0,
  damage_pests_hectares: 0,
  damage_calamity_hectares: 0,
  stocking: 0,
  harvesting_fishery: 0,
  pests_diseases: "None",
  calamity: "None",
  remarks: "",
};

export default function RecordFormDialog({ open, onClose, mode, initialData, defaultBarangay }: Props) {
  const { addRecord, updateRecord, getFarmersByIds } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();
  const availableBarangays = isBarangayUser && userBarangay ? [userBarangay] : BARANGAYS;
  const [form, setForm] = useState({ ...emptyForm });
  const [farmerSelectOpen, setFarmerSelectOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSuccessMsg(null);
      if (mode === "edit" && initialData) {
        setForm({
          barangay: initialData.barangay,
          commodity: initialData.commodity,
          sub_category: initialData.sub_category,
          farmer_ids: initialData.farmer_ids || [],
          planting_area_hectares: initialData.planting_area_hectares,
          harvesting_output_bags: initialData.harvesting_output_bags,
          damage_pests_hectares: initialData.damage_pests_hectares,
          damage_calamity_hectares: initialData.damage_calamity_hectares,
          stocking: initialData.stocking,
          harvesting_fishery: initialData.harvesting_fishery,
          pests_diseases: initialData.pests_diseases,
          calamity: initialData.calamity,
          remarks: initialData.remarks,
        });
      } else {
        setForm({ ...emptyForm, barangay: defaultBarangay || (isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]) });
      }
    }
  }, [open, mode, initialData, defaultBarangay]);

  if (!open) return null;

  const isFishery = form.commodity === "Fishery";
  const isCorn = form.commodity === "Corn";
  const subTypes = SUB_TYPES[form.commodity] || [];
  const linkedFarmers = getFarmersByIds(form.farmer_ids);

  function handleCommodityChange(commodity: AgriRecord["commodity"]) {
    const subs = SUB_TYPES[commodity] || [];
    setForm((f) => ({
      ...f,
      commodity,
      sub_category: commodity === "Corn" ? "Corn" : subs[0] || "",
      planting_area_hectares: commodity === "Fishery" ? 0 : f.planting_area_hectares,
      harvesting_output_bags: commodity === "Fishery" ? 0 : f.harvesting_output_bags,
      damage_pests_hectares: commodity === "Fishery" ? 0 : f.damage_pests_hectares,
      damage_calamity_hectares: commodity === "Fishery" ? 0 : f.damage_calamity_hectares,
      stocking: commodity === "Fishery" ? f.stocking : 0,
      harvesting_fishery: commodity === "Fishery" ? f.harvesting_fishery : 0,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      sub_category: isCorn ? "Corn" : form.sub_category,
      farmer_ids: form.farmer_ids,
    };
    if (mode === "edit" && initialData) {
      updateRecord(initialData.id, data);
      onClose();
    } else {
      addRecord(data);
      setSuccessMsg("Record added successfully!");
      setForm({ ...emptyForm, barangay: form.barangay });
      setTimeout(() => setSuccessMsg(null), 1500);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-green-400 focus:bg-white transition";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {mode === "add" ? "Add New Record" : "Edit Record"}
            </h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700 flex items-center gap-2 animate-in">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Barangay + Commodity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Barangay</label>
                {isBarangayUser ? (
                  <div className={inputCls + " flex items-center gap-2 bg-gray-100 cursor-not-allowed"}>
                    <span className="text-gray-700 font-medium">{userBarangay}</span>
                    <span className="ml-auto text-[10px] text-gray-400">🔒 Assigned</span>
                  </div>
                ) : (
                  <select className={inputCls} value={form.barangay} onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value, farmer_ids: [] }))}>
                    {availableBarangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>Commodity</label>
                <select className={inputCls} value={form.commodity} onChange={(e) => handleCommodityChange(e.target.value as AgriRecord["commodity"])}>
                  {COMMODITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Variety */}
            {!isCorn && subTypes.length > 0 && (
              <div>
                <label className={labelCls}>Variety / Type</label>
                <select className={inputCls} value={form.sub_category} onChange={(e) => setForm((f) => ({ ...f, sub_category: e.target.value }))}>
                  {subTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Farmer Selection */}
            <div>
              <label className={labelCls}>Farmers / Fisherfolks</label>
              <button
                type="button"
                onClick={() => setFarmerSelectOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 hover:bg-white hover:border-green-400 transition"
              >
                <Users size={14} className="text-gray-400" />
                {linkedFarmers.length > 0
                  ? <span className="text-gray-700">{linkedFarmers.length} farmer{linkedFarmers.length !== 1 ? "s" : ""} selected</span>
                  : <span>Select farmers from registry...</span>}
              </button>
              {linkedFarmers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {linkedFarmers.map((f) => (
                    <span key={f.id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${f.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-500"}`}>
                      {f.name}
                      <button type="button" onClick={() => setForm((prev) => ({ ...prev, farmer_ids: prev.farmer_ids.filter((id) => id !== f.id) }))} className="ml-1 hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Crop fields (hidden for Fishery) */}
            {!isFishery && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Planting Area (hectares)</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.planting_area_hectares || ""} onChange={(e) => setForm((f) => ({ ...f, planting_area_hectares: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Harvesting (bags @40kg)</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.harvesting_output_bags || ""} onChange={(e) => setForm((f) => ({ ...f, harvesting_output_bags: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Damage — Pests & Diseases (ha)</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.damage_pests_hectares || ""} onChange={(e) => setForm((f) => ({ ...f, damage_pests_hectares: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Damage — Calamity (ha)</label>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.damage_calamity_hectares || ""} onChange={(e) => setForm((f) => ({ ...f, damage_calamity_hectares: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </>
            )}

            {/* Fishery fields */}
            {isFishery && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stocking</label>
                  <input type="number" min={0} step="0.01" className={inputCls} value={form.stocking || ""} onChange={(e) => setForm((f) => ({ ...f, stocking: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className={labelCls}>Harvesting (Fishery)</label>
                  <input type="number" min={0} step="0.01" className={inputCls} value={form.harvesting_fishery || ""} onChange={(e) => setForm((f) => ({ ...f, harvesting_fishery: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
            )}

            {/* Pests & Calamity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pests & Diseases</label>
                <input className={inputCls} value={form.pests_diseases} onChange={(e) => setForm((f) => ({ ...f, pests_diseases: e.target.value }))} placeholder="e.g. Rice Blast, Stem Borer or None" />
              </div>
              <div>
                <label className={labelCls}>Calamity</label>
                <input className={inputCls} value={form.calamity} onChange={(e) => setForm((f) => ({ ...f, calamity: e.target.value }))} placeholder="e.g. Typhoon Egay or None" />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className={labelCls}>Remarks (optional)</label>
              <textarea className={inputCls + " resize-none"} rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes..." />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">{mode === "add" ? "Close" : "Cancel"}</button>
              <button type="submit" className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                {mode === "add" ? "Add Record" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <FarmerSelectDialog
        open={farmerSelectOpen}
        onClose={() => setFarmerSelectOpen(false)}
        barangay={form.barangay}
        selectedIds={form.farmer_ids}
        onConfirm={(ids) => setForm((f) => ({ ...f, farmer_ids: ids }))}
      />
    </>
  );
}
