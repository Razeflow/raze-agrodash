"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { Farmer, FarmerAsset, FarmerAssetCategory } from "@/lib/data";
import {
  FARMER_ASSET_CATEGORIES,
  FARMER_ASSET_CATEGORY_LABELS,
  formatFarmerAssetSummary,
  getAssetSubCategoryOptions,
} from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import { useBeforeUnloadWarning } from "@/hooks/useDirtyForm";
import DialogPortal from "@/components/ui/DialogPortal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Props = {
  open: boolean;
  onClose: () => void;
  farmer: Farmer | null;
};

type Draft = {
  category: FarmerAssetCategory;
  sub_category: string;
  product_detail: string;
  quantity: string;
  unit: string;
  area_hectares: string;
  acquired_date: string;
  notes: string;
  parcel_label: string;
};

const emptyNew = (): Draft => ({
  category: "planting_area",
  sub_category: "",
  product_detail: "",
  quantity: "",
  unit: "",
  area_hectares: "",
  acquired_date: "",
  notes: "",
  parcel_label: "",
});

function assetToDraft(a: FarmerAsset): Draft {
  return {
    category: a.category,
    sub_category: a.sub_category ?? "",
    product_detail: a.product_detail ?? "",
    quantity: a.quantity != null ? String(a.quantity) : "",
    unit: a.unit ?? "",
    area_hectares: a.area_hectares != null ? String(a.area_hectares) : "",
    acquired_date: a.acquired_date ?? "",
    notes: a.notes ?? "",
    parcel_label: a.parcel_label ?? "",
  };
}

function validatePlantingAreaDraft(d: Draft): string | null {
  if (d.category !== "planting_area") return null;
  if (!d.parcel_label.trim()) return "Parcel label is required for planting-area assets (e.g. \"Farm Lot A\").";
  const ha = parseFloat(d.area_hectares);
  if (!Number.isFinite(ha) || ha <= 0) return "Area (hectares) must be greater than 0 for planting-area assets.";
  return null;
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return s.trim() === "" || Number.isNaN(n) ? null : n;
}

export default function FarmerAssetsDialog({ open, onClose, farmer }: Props) {
  const { getAssetsForFarmer, addFarmerAsset, updateFarmerAsset, deleteFarmerAsset } = useAgriData();
  const { mounted, visible } = useAnimatedMount(open);

  const [newItem, setNewItem] = useState<Draft>(emptyNew);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  // Week 3.5 Part 8: declared above the useEffect so the close branch
  // can reset it without a TDZ violation — dirty/safeClose logic below.
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const assets = useMemo(
    () => (farmer ? getAssetsForFarmer(farmer.id) : []),
    [farmer, getAssetsForFarmer],
  );

  useEffect(() => {
    if (open) {
      setNewItem(emptyNew());
      setEditingId(null);
      setEditDraft(null);
      setErrorMsg(null);
    } else {
      setShowDiscardConfirm(false);
    }
  }, [open, farmer]);

  // Week 3.5 Part 8: dirty + safeClose. No parent form to compare, so
  // dirty is "user is mid-editing an asset line OR has typed into the
  // new-asset draft". useBeforeUnloadWarning still catches tab close.
  // All hooks below MUST run on every render — placed BEFORE the early
  // `if (!mounted || !farmer)` return. (showDiscardConfirm is declared
  // higher up so the open/close useEffect can reset it.)
  const dirty =
    editingId !== null ||
    newItem.category !== "planting_area" ||
    newItem.sub_category.trim() !== "" ||
    newItem.product_detail.trim() !== "" ||
    newItem.quantity.trim() !== "" ||
    newItem.unit.trim() !== "" ||
    newItem.area_hectares.trim() !== "" ||
    newItem.acquired_date !== "" ||
    newItem.notes.trim() !== "" ||
    newItem.parcel_label.trim() !== "";
  useBeforeUnloadWarning(dirty && open);
  function safeClose() {
    if (dirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }

  if (!mounted || !farmer) return null;
  const f = farmer;

  async function handleAdd() {
    setErrorMsg(null);
    const sub = newItem.sub_category.trim();
    const needsSub =
      newItem.category === "machinery" ||
      newItem.category === "facility" ||
      newItem.category === "livestock";
    if (needsSub && !sub) {
      setErrorMsg("Please choose a sub-category.");
      return;
    }
    const plantingAreaErr = validatePlantingAreaDraft(newItem);
    if (plantingAreaErr) {
      setErrorMsg(plantingAreaErr);
      return;
    }
    const res = await addFarmerAsset({
      farmer_id: f.id,
      category: newItem.category,
      sub_category: sub || null,
      product_detail: newItem.product_detail.trim() || null,
      quantity: parseNum(newItem.quantity),
      unit: newItem.unit.trim() || null,
      area_hectares: parseNum(newItem.area_hectares),
      acquired_date: newItem.acquired_date.trim() || null,
      notes: newItem.notes.trim() || null,
      parcel_label: newItem.category === "planting_area" ? newItem.parcel_label.trim() : null,
    });
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setNewItem(emptyNew());
  }

  async function handleSaveEdit() {
    if (!editingId || !editDraft) return;
    setErrorMsg(null);
    const sub = editDraft.sub_category.trim();
    const needsSub =
      editDraft.category === "machinery" ||
      editDraft.category === "facility" ||
      editDraft.category === "livestock";
    if (needsSub && !sub) {
      setErrorMsg("Please choose a sub-category.");
      return;
    }
    const plantingAreaErr = validatePlantingAreaDraft(editDraft);
    if (plantingAreaErr) {
      setErrorMsg(plantingAreaErr);
      return;
    }
    const res = await updateFarmerAsset(editingId, {
      category: editDraft.category,
      sub_category: sub || null,
      product_detail: editDraft.product_detail.trim() || null,
      quantity: parseNum(editDraft.quantity),
      unit: editDraft.unit.trim() || null,
      area_hectares: parseNum(editDraft.area_hectares),
      acquired_date: editDraft.acquired_date.trim() || null,
      notes: editDraft.notes.trim() || null,
      parcel_label: editDraft.category === "planting_area" ? editDraft.parcel_label.trim() : null,
    });
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleDelete(id: string) {
    setErrorMsg(null);
    const res = await deleteFarmerAsset(id);
    if (!res.ok) setErrorMsg(res.message);
  }

  const inputCls =
    "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-500 mb-1";

  const assetFields = (d: Draft, set: (u: Draft) => void) => {
    const subOptions = getAssetSubCategoryOptions(d.category);
    const showArea = d.category === "planting_area" || d.category === "fishpond";
    const isPlantingArea = d.category === "planting_area";
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={subOptions.length > 0 ? "" : "sm:col-span-2"}>
          <label className={labelCls}>Category</label>
          <select
            className={inputCls}
            value={d.category}
            onChange={(e) => {
              const next = e.target.value as FarmerAssetCategory;
              set({ ...d, category: next, sub_category: "" });
            }}
          >
            {FARMER_ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FARMER_ASSET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {isPlantingArea && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Parcel label <span className="text-red-500">*</span></label>
            <input
              className={inputCls}
              value={d.parcel_label}
              onChange={(e) => set({ ...d, parcel_label: e.target.value })}
              placeholder='e.g. "Farm Lot A" — used to allocate crop records to this lot'
            />
          </div>
        )}
        {subOptions.length > 0 && (
          <div>
            <label className={labelCls}>Sub-category</label>
            <select
              className={inputCls}
              value={d.sub_category}
              onChange={(e) => set({ ...d, sub_category: e.target.value })}
            >
              <option value="">Select…</option>
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelCls}>Detail (variety, model, location…)</label>
          <input
            className={inputCls}
            value={d.product_detail}
            onChange={(e) => set({ ...d, product_detail: e.target.value })}
            placeholder="Optional detail"
          />
        </div>
        <div>
          <label className={labelCls}>Quantity</label>
          <input
            className={inputCls}
            type="number"
            min={0}
            step="any"
            value={d.quantity}
            onChange={(e) => set({ ...d, quantity: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Unit</label>
          <input
            className={inputCls}
            value={d.unit}
            onChange={(e) => set({ ...d, unit: e.target.value })}
            placeholder={d.category === "livestock" ? "head, pcs…" : "pcs, units…"}
          />
        </div>
        {showArea && (
          <div>
            <label className={labelCls}>
              Area (hectares){isPlantingArea && <span className="text-red-500"> *</span>}
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step="any"
              value={d.area_hectares}
              onChange={(e) => set({ ...d, area_hectares: e.target.value })}
            />
          </div>
        )}
        <div className={showArea ? "" : "sm:col-span-2"}>
          <label className={labelCls}>Acquired date</label>
          <input
            className={inputCls}
            type="date"
            value={d.acquired_date}
            onChange={(e) => set({ ...d, acquired_date: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <input
            className={inputCls}
            value={d.notes}
            onChange={(e) => set({ ...d, notes: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <DialogPortal>
        <div className="fixed inset-0 lg:left-24 z-[65] overflow-y-auto">
          <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={safeClose} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className={`relative z-10 w-full max-w-lg max-h-[min(92vh,900px)] overflow-y-auto rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}
            >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Farmer assets</h2>
              <button type="button" onClick={safeClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {f.name} · {f.barangay} — Track planting area, machinery, fishpond, facilities, and livestock owned by this farmer.
            </p>
            {errorMsg && (
              <div className="mb-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-2.5 text-sm font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/30 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Asset items</p>
              <p className="text-[11px] text-slate-600">Each line saves immediately when you add, update, or delete.</p>

              {assets.length > 0 && (
                <ul className="space-y-2">
                  {assets.map((a) => (
                    <li key={a.id} className="rounded-xl border border-white/60 bg-white/60 p-3">
                      {editingId === a.id && editDraft ? (
                        <div className="space-y-2">
                          {assetFields(editDraft, (u) => setEditDraft(u))}
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(null);
                              }}
                              className="rounded-[1.5rem] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit()}
                              className="rounded-[1.5rem] bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Save line
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-xs text-slate-800 flex-1 min-w-0">{formatFarmerAssetSummary(a)}</p>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(a.id);
                                setEditDraft(assetToDraft(a));
                              }}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-100 hover:text-emerald-800"
                              aria-label="Edit asset"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteAssetId(a.id)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              aria-label="Delete asset"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-emerald-100/80 pt-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Add asset</p>
                {assetFields(newItem, setNewItem)}
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[1.5rem] bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Plus size={14} /> Add asset
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={safeClose}
                className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      </DialogPortal>

      <ConfirmDialog
        open={!!deleteAssetId}
        onClose={() => setDeleteAssetId(null)}
        title="Delete asset line"
        description="Are you sure you want to delete this asset line item? This action cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!deleteAssetId) return false;
          setErrorMsg(null);
          const res = await deleteFarmerAsset(deleteAssetId);
          if (!res.ok) {
            setErrorMsg(res.message);
            return false;
          }
        }}
      />

      <ConfirmDialog
        open={showDiscardConfirm}
        danger={false}
        title="Discard unsaved changes?"
        description="You've made changes that haven't been saved. Continue editing or discard?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={async () => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onClose={() => setShowDiscardConfirm(false)}
      />
    </>
  );
}
