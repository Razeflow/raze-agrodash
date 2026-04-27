"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { Household, HouseholdSubsidy, SubsidyCategory } from "@/lib/data";
import { ORG_TYPE_LABELS, SUBSIDY_CATEGORIES, SUBSIDY_CATEGORY_LABELS, formatHouseholdSubsidySummary } from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  household: Household | null;
};

const emptyNew = (): {
  category: SubsidyCategory;
  product_detail: string;
  quantity: string;
  unit: string;
  amount_php: string;
  program_source: string;
  received_date: string;
  notes: string;
} => ({
  category: "fertilizer",
  product_detail: "",
  quantity: "",
  unit: "",
  amount_php: "",
  program_source: "",
  received_date: "",
  notes: "",
});

export default function HouseholdEditDialog({ open, onClose, household }: Props) {
  const {
    updateHousehold,
    organizations,
    getSubsidiesForHousehold,
    addHouseholdSubsidy,
    updateHouseholdSubsidy,
    deleteHouseholdSubsidy,
  } = useAgriData();
  const { mounted, visible } = useAnimatedMount(open);
  const [displayName, setDisplayName] = useState("");
  const [farmingHa, setFarmingHa] = useState(0);
  const [notes, setNotes] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [newItem, setNewItem] = useState(emptyNew);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ReturnType<typeof emptyNew> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subsidies = useMemo(
    () => (household ? getSubsidiesForHousehold(household.id) : []),
    [household, getSubsidiesForHousehold],
  );

  useEffect(() => {
    if (open && household) {
      setDisplayName(household.display_name);
      setFarmingHa(household.farming_area_hectares ?? 0);
      setNotes(household.rffa_subsidies_notes ?? "");
      setOrgId(household.organization_id || "");
      setNewItem(emptyNew());
      setEditingId(null);
      setEditDraft(null);
      setErrorMsg(null);
    }
  }, [open, household]);

  if (!mounted || !household) return null;

  const hh = household;

  const orgsInBarangay = organizations.filter(
    (o) => !o.barangay || o.barangay === hh.barangay,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = await updateHousehold(hh.id, {
      display_name: displayName.trim() || hh.display_name,
      farming_area_hectares: farmingHa,
      rffa_subsidies_notes: notes,
      organization_id: orgId || null,
    });
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    onClose();
  }

  function subsidyToDraft(s: HouseholdSubsidy) {
    return {
      category: s.category,
      product_detail: s.product_detail ?? "",
      quantity: s.quantity != null ? String(s.quantity) : "",
      unit: s.unit ?? "",
      amount_php: s.amount_php != null ? String(s.amount_php) : "",
      program_source: s.program_source ?? "",
      received_date: s.received_date ?? "",
      notes: s.notes ?? "",
    };
  }

  function parseNum(s: string): number | null {
    const n = parseFloat(s);
    return s.trim() === "" || Number.isNaN(n) ? null : n;
  }

  async function handleAddSubsidy() {
    setErrorMsg(null);
    const res = await addHouseholdSubsidy({
      household_id: hh.id,
      category: newItem.category,
      product_detail: newItem.product_detail.trim() || null,
      quantity: parseNum(newItem.quantity),
      unit: newItem.unit.trim() || null,
      amount_php: parseNum(newItem.amount_php),
      program_source: newItem.program_source.trim() || null,
      received_date: newItem.received_date.trim() || null,
      notes: newItem.notes.trim() || null,
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
    const res = await updateHouseholdSubsidy(editingId, {
      category: editDraft.category,
      product_detail: editDraft.product_detail.trim() || null,
      quantity: parseNum(editDraft.quantity),
      unit: editDraft.unit.trim() || null,
      amount_php: parseNum(editDraft.amount_php),
      program_source: editDraft.program_source.trim() || null,
      received_date: editDraft.received_date.trim() || null,
      notes: editDraft.notes.trim() || null,
    });
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleDeleteSubsidy(id: string) {
    setErrorMsg(null);
    const res = await deleteHouseholdSubsidy(id);
    if (!res.ok) setErrorMsg(res.message);
  }

  const inputCls =
    "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-500 mb-1";

  const subsidyFields = (d: typeof newItem, set: (u: typeof newItem) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Category</label>
        <select className={inputCls} value={d.category} onChange={(e) => set({ ...d, category: e.target.value as SubsidyCategory })}>
          {SUBSIDY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUBSIDY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Product / variety (e.g. Urea, Complete, Hybrid rice, Tilapia)</label>
        <input className={inputCls} value={d.product_detail} onChange={(e) => set({ ...d, product_detail: e.target.value })} placeholder="Optional detail" />
      </div>
      <div>
        <label className={labelCls}>Quantity</label>
        <input className={inputCls} type="number" min={0} step="any" value={d.quantity} onChange={(e) => set({ ...d, quantity: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Unit</label>
        <input className={inputCls} value={d.unit} onChange={(e) => set({ ...d, unit: e.target.value })} placeholder="bag, kg, pcs…" />
      </div>
      <div>
        <label className={labelCls}>Amount (PHP)</label>
        <input className={inputCls} type="number" min={0} step="any" value={d.amount_php} onChange={(e) => set({ ...d, amount_php: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Date received</label>
        <input className={inputCls} type="date" value={d.received_date} onChange={(e) => set({ ...d, received_date: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Program / source</label>
        <input className={inputCls} value={d.program_source} onChange={(e) => set({ ...d, program_source: e.target.value })} placeholder="RFFA, SAAD, LGU…" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Line notes</label>
        <input className={inputCls} value={d.notes} onChange={(e) => set({ ...d, notes: e.target.value })} placeholder="Optional" />
      </div>
    </div>
  );

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-[65] overflow-y-auto">
        <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-lg max-h-[min(92vh,900px)] overflow-y-auto rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Edit household and subsidies</h2>
              <button type="button" onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {hh.barangay} · Shared farming area and RFFA / subsidies are tracked per household.
            </p>
            {errorMsg && (
              <div className="mb-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-2.5 text-sm font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Household name</label>
                <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Shared farming area (ha)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={farmingHa}
                  onChange={(e) => setFarmingHa(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={labelCls}>RFFA and subsidies (narrative notes)</label>
                <textarea
                  className={inputCls + " resize-none"}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Programs, context, dates…"
                />
              </div>
              <div>
                <label className={labelCls}>Household organization (optional)</label>
                <select className={inputCls} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">None</option>
                  {orgsInBarangay.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({ORG_TYPE_LABELS[o.org_type]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/30 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Subsidy / assistance items</p>
                <p className="text-[11px] text-slate-600">Each line saves immediately when you add, update, or delete.</p>

                {subsidies.length > 0 && (
                  <ul className="space-y-2">
                    {subsidies.map((s) => (
                      <li key={s.id} className="rounded-xl border border-white/60 bg-white/60 p-3">
                        {editingId === s.id && editDraft ? (
                          <div className="space-y-2">
                            {subsidyFields(editDraft, (u) => setEditDraft(u))}
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
                            <p className="text-xs text-slate-800 flex-1 min-w-0">{formatHouseholdSubsidySummary([s])}</p>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(s.id);
                                  setEditDraft(subsidyToDraft(s));
                                }}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-100 hover:text-emerald-800"
                                aria-label="Edit subsidy line"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteSubsidy(s.id)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                aria-label="Delete subsidy line"
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Add item</p>
                  {subsidyFields(newItem, setNewItem)}
                  <button
                    type="button"
                    onClick={() => void handleAddSubsidy()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[1.5rem] bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus size={14} /> Add assistance item
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-[1.5rem] bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition"
                >
                  Save household
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
