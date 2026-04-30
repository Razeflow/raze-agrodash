"use client";
import { useState, useEffect } from "react";
import { X, Users, CheckCircle2, AlertCircle } from "lucide-react";
import type { AgriRecord } from "@/lib/data";
import {
  BARANGAYS,
  COMMODITY_OPTIONS,
  SUB_TYPES,
  getCurrentPHPeriod,
  MONTH_NAMES,
  CALAMITY_SUB_CATEGORIES,
  CALAMITY_SUB_CATEGORY_LABELS,
  type CalamitySubCategory,
} from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";
import FarmerSelectDialog from "./FarmerSelectDialog";
import { recordFormSchema, RECORD_LIMITS, zodIssuesToErrors } from "@/lib/validations";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initialData?: AgriRecord;
  defaultBarangay?: string;
};

type FormErrors = {
  commodity?: string;
  farmer_ids?: string;
  period?: string;
  // Numeric/cross-field errors raised by the Zod schema.
  planting_area_hectares?: string;
  harvesting_output_bags?: string;
  damage_pests_hectares?: string;
  damage_calamity_hectares?: string;
  stocking?: string;
  harvesting_fishery?: string;
  calamity?: string;
  remarks?: string;
};

function getEmptyForm() {
  const { month, year } = getCurrentPHPeriod();
  return {
    barangay: BARANGAYS[0] as string,
    commodity: "Rice" as AgriRecord["commodity"],
    sub_category: "Hybrid",
    farmer_ids: [] as string[],
    period_month: month,
    period_year: year,
    planting_area_hectares: 0,
    harvesting_output_bags: 0,
    damage_pests_hectares: 0,
    damage_calamity_hectares: 0,
    stocking: 0,
    harvesting_fishery: 0,
    pests_diseases: "None",
    calamity: "None",
    calamity_sub_category: "None" as CalamitySubCategory,
    remarks: "",
  };
}

export default function RecordFormDialog({ open, onClose, mode, initialData, defaultBarangay }: Props) {
  const { addRecord, updateRecord, getFarmersByIds } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();
  const { mounted, visible } = useAnimatedMount(open);
  const availableBarangays = isBarangayUser && userBarangay ? [userBarangay] : BARANGAYS;
  const [form, setForm] = useState(getEmptyForm());
  const [farmerSelectOpen, setFarmerSelectOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccessMsg(null);
      setErrorMsg(null);
      setErrors({});
      setSubmitted(false);
      if (mode === "edit" && initialData) {
        setForm({
          barangay: initialData.barangay,
          commodity: initialData.commodity,
          sub_category: initialData.sub_category,
          farmer_ids: initialData.farmer_ids || [],
          period_month: initialData.period_month || getCurrentPHPeriod().month,
          period_year: initialData.period_year || getCurrentPHPeriod().year,
          planting_area_hectares: initialData.planting_area_hectares,
          harvesting_output_bags: initialData.harvesting_output_bags,
          damage_pests_hectares: initialData.damage_pests_hectares,
          damage_calamity_hectares: initialData.damage_calamity_hectares,
          stocking: initialData.stocking,
          harvesting_fishery: initialData.harvesting_fishery,
          pests_diseases: initialData.pests_diseases,
          calamity: initialData.calamity,
          calamity_sub_category: initialData.calamity_sub_category ?? "None",
          remarks: initialData.remarks,
        });
      } else {
        const empty = getEmptyForm();
        setForm({ ...empty, barangay: defaultBarangay || (isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]) });
      }
    }
  }, [open, mode, initialData, defaultBarangay, isBarangayUser, userBarangay]);

  if (!mounted) return null;

  const isFishery = form.commodity === "Fishery";
  const isCorn = form.commodity === "Corn";
  const subTypes = SUB_TYPES[form.commodity] || [];
  const linkedFarmers = getFarmersByIds(form.farmer_ids);

  // Generate year options (current PH year -2 to +1)
  const { year: currentYear } = getCurrentPHPeriod();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  function validate(): FormErrors {
    const result = recordFormSchema.safeParse(form);
    if (result.success) return {};
    const fieldErrors = zodIssuesToErrors(result.error.issues);
    // Collapse period_month / period_year errors under the shared `period` key
    // so the existing single-row "Reporting period is required" UI still works.
    const errs: FormErrors = { ...(fieldErrors as FormErrors) };
    if (fieldErrors.period_month || fieldErrors.period_year) {
      errs.period = fieldErrors.period_month || fieldErrors.period_year;
    }
    return errs;
  }

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
      calamity: commodity === "Fishery" ? "None" : f.calamity,
      calamity_sub_category: commodity === "Fishery" ? "None" : f.calamity_sub_category,
    }));
    if (submitted) setErrors((e) => ({ ...e, commodity: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const data = {
      ...form,
      sub_category: isCorn ? "Corn" : form.sub_category,
      farmer_ids: form.farmer_ids,
      period_month: form.period_month,
      period_year: form.period_year,
    };
    setSaving(true);
    try {
      if (mode === "edit" && initialData) {
        const res = await updateRecord(initialData.id, data);
        if (!res.ok) {
          setErrorMsg(res.message);
          return;
        }
        onClose();
      } else {
        const result = await addRecord(data);
        if (!result.ok) {
          setErrorMsg(result.message);
          return;
        }
        setSuccessMsg("Record added successfully!");
        const empty = getEmptyForm();
        setForm({ ...empty, barangay: form.barangay });
        setErrors({});
        setSubmitted(false);
        setTimeout(() => setSuccessMsg(null), 1500);
      }
    } catch (err) {
      console.error("[RecordForm] submit error", err);
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error while saving.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2.5 sm:py-2 text-base sm:text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const inputErrCls = "w-full rounded-[1.5rem] border border-red-300 bg-red-50/30 backdrop-blur px-3 py-2.5 sm:py-2 text-base sm:text-sm text-gray-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition";
  const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-500 mb-1";
  const errTextCls = "text-[11px] text-red-500 mt-1 flex items-center gap-1";

  return (
    <>
      <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-50 overflow-y-auto">
        <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative z-10 w-full max-w-2xl rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {mode === "add" ? "Add New Record" : "Edit Record"}
            </h2>
            <button onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 px-4 py-2.5 text-sm font-medium text-green-700 flex items-center gap-2 animate-in">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-2.5 text-sm font-medium text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {submitted && Object.keys(errors).length > 0 && (
            <div className="mb-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-2.5 text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertCircle size={16} /> Please fix the errors below before submitting.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reporting Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Reporting Month <span className="text-red-400">*</span></label>
                <select
                  className={errors.period ? inputErrCls : inputCls}
                  value={form.period_month}
                  onChange={(e) => { setForm((f) => ({ ...f, period_month: parseInt(e.target.value) })); if (submitted) setErrors((er) => ({ ...er, period: undefined })); }}
                >
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reporting Year <span className="text-red-400">*</span></label>
                <select
                  className={errors.period ? inputErrCls : inputCls}
                  value={form.period_year}
                  onChange={(e) => { setForm((f) => ({ ...f, period_year: parseInt(e.target.value) })); if (submitted) setErrors((er) => ({ ...er, period: undefined })); }}
                >
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {errors.period && <p className={errTextCls}><AlertCircle size={11} /> {errors.period}</p>}
              </div>
            </div>

            {/* Barangay + Commodity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Barangay <span className="text-red-400">*</span></label>
                {isBarangayUser ? (
                  <div className={inputCls + " flex items-center gap-2 bg-white/30 cursor-not-allowed"}>
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
                <label className={labelCls}>Commodity <span className="text-red-400">*</span></label>
                <select className={errors.commodity ? inputErrCls : inputCls} value={form.commodity} onChange={(e) => handleCommodityChange(e.target.value as AgriRecord["commodity"])}>
                  {COMMODITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.commodity && <p className={errTextCls}><AlertCircle size={11} /> {errors.commodity}</p>}
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
              <label className={labelCls}>Farmers / Fisherfolks <span className="text-red-400">*</span></label>
              <button
                type="button"
                onClick={() => setFarmerSelectOpen(true)}
                className={`flex w-full items-center gap-2 rounded-[1.5rem] border px-3 py-2 text-sm transition ${
                  errors.farmer_ids
                    ? "border-red-300 bg-red-50/30 text-red-500 hover:border-red-400"
                    : "border-slate-200/50 bg-white/50 text-gray-500 hover:bg-white/70 hover:border-emerald-400"
                }`}
              >
                <Users size={14} className={errors.farmer_ids ? "text-red-400" : "text-gray-400"} />
                {linkedFarmers.length > 0
                  ? <span className="text-gray-700">{linkedFarmers.length} farmer{linkedFarmers.length !== 1 ? "s" : ""} selected</span>
                  : <span>{errors.farmer_ids ? "⚠ No farmers selected" : "Select farmers from registry..."}</span>}
              </button>
              {errors.farmer_ids && <p className={errTextCls}><AlertCircle size={11} /> {errors.farmer_ids}</p>}
              {linkedFarmers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {linkedFarmers.map((f) => (
                    <span key={f.id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${f.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-500"}`}>
                      {f.name}
                      <button type="button" onClick={() => { setForm((prev) => ({ ...prev, farmer_ids: prev.farmer_ids.filter((id) => id !== f.id) })); if (submitted) setErrors((er) => ({ ...er, farmer_ids: undefined })); }} className="ml-1 hover:text-red-500">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Planting Area (hectares)</label>
                    <input
                      type="number"
                      min={0}
                      max={RECORD_LIMITS.AREA_MAX}
                      step="0.01"
                      className={errors.planting_area_hectares ? inputErrCls : inputCls}
                      value={form.planting_area_hectares || ""}
                      onChange={(e) => { setForm((f) => ({ ...f, planting_area_hectares: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, planting_area_hectares: undefined, damage_calamity_hectares: undefined })); }}
                    />
                    {errors.planting_area_hectares && <p className={errTextCls}><AlertCircle size={11} /> {errors.planting_area_hectares}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Harvest Output (bags @ 40kg)</label>
                    <input
                      type="number"
                      min={0}
                      max={RECORD_LIMITS.BAGS_MAX}
                      step="0.01"
                      className={errors.harvesting_output_bags ? inputErrCls : inputCls}
                      value={form.harvesting_output_bags || ""}
                      onChange={(e) => { setForm((f) => ({ ...f, harvesting_output_bags: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, harvesting_output_bags: undefined })); }}
                    />
                    {errors.harvesting_output_bags && <p className={errTextCls}><AlertCircle size={11} /> {errors.harvesting_output_bags}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Damage -- Pests & Diseases (ha)</label>
                    <input
                      type="number"
                      min={0}
                      max={RECORD_LIMITS.AREA_MAX}
                      step="0.01"
                      className={errors.damage_pests_hectares ? inputErrCls : inputCls}
                      value={form.damage_pests_hectares || ""}
                      onChange={(e) => { setForm((f) => ({ ...f, damage_pests_hectares: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, damage_pests_hectares: undefined, damage_calamity_hectares: undefined })); }}
                    />
                    {errors.damage_pests_hectares && <p className={errTextCls}><AlertCircle size={11} /> {errors.damage_pests_hectares}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Damage -- Calamity (ha)</label>
                    <input
                      type="number"
                      min={0}
                      max={RECORD_LIMITS.AREA_MAX}
                      step="0.01"
                      className={errors.damage_calamity_hectares ? inputErrCls : inputCls}
                      value={form.damage_calamity_hectares || ""}
                      onChange={(e) => { setForm((f) => ({ ...f, damage_calamity_hectares: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, damage_calamity_hectares: undefined })); }}
                    />
                    {errors.damage_calamity_hectares && <p className={errTextCls}><AlertCircle size={11} /> {errors.damage_calamity_hectares}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Fishery fields */}
            {isFishery && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stocking</label>
                  <input
                    type="number"
                    min={0}
                    max={RECORD_LIMITS.STOCKING_MAX}
                    step="0.01"
                    className={errors.stocking ? inputErrCls : inputCls}
                    value={form.stocking || ""}
                    onChange={(e) => { setForm((f) => ({ ...f, stocking: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, stocking: undefined })); }}
                  />
                  {errors.stocking && <p className={errTextCls}><AlertCircle size={11} /> {errors.stocking}</p>}
                </div>
                <div>
                  <label className={labelCls}>Harvesting (Fishery)</label>
                  <input
                    type="number"
                    min={0}
                    max={RECORD_LIMITS.FISHERY_HARVEST_MAX}
                    step="0.01"
                    className={errors.harvesting_fishery ? inputErrCls : inputCls}
                    value={form.harvesting_fishery || ""}
                    onChange={(e) => { setForm((f) => ({ ...f, harvesting_fishery: parseFloat(e.target.value) || 0 })); if (submitted) setErrors((er) => ({ ...er, harvesting_fishery: undefined })); }}
                  />
                  {errors.harvesting_fishery && <p className={errTextCls}><AlertCircle size={11} /> {errors.harvesting_fishery}</p>}
                </div>
              </div>
            )}

            {/* Pests & Calamity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pests & Diseases</label>
                <input className={inputCls} value={form.pests_diseases} onChange={(e) => setForm((f) => ({ ...f, pests_diseases: e.target.value }))} placeholder="e.g. Rice Blast, Stem Borer or None" />
              </div>
              <div>
                <label className={labelCls}>Calamity type</label>
                <select
                  className={inputCls}
                  value={form.calamity_sub_category}
                  onChange={(e) => setForm((f) => ({ ...f, calamity_sub_category: e.target.value as CalamitySubCategory }))}
                >
                  {CALAMITY_SUB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CALAMITY_SUB_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Calamity event or name</label>
                <input
                  className={errors.calamity ? inputErrCls : inputCls}
                  value={form.calamity}
                  onChange={(e) => { setForm((f) => ({ ...f, calamity: e.target.value })); if (submitted) setErrors((er) => ({ ...er, calamity: undefined })); }}
                  placeholder="e.g. Typhoon Egay, barangay sitio — or None"
                />
                {errors.calamity && <p className={errTextCls}><AlertCircle size={11} /> {errors.calamity}</p>}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className={labelCls}>Remarks (optional)</label>
              <textarea className="w-full rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition resize-none" rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes..." />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="w-full sm:w-auto rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-white/70 transition">{mode === "add" ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={saving} className={`w-full sm:w-auto rounded-[1.5rem] px-5 py-2.5 sm:py-2 text-sm font-black text-white shadow-lg transition ${saving ? "bg-slate-400 cursor-not-allowed shadow-slate-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"}`}>
                {saving ? "Saving…" : mode === "add" ? "Add Record" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
        </div>
      </div>
      </DialogPortal>

      <FarmerSelectDialog
        open={farmerSelectOpen}
        onClose={() => setFarmerSelectOpen(false)}
        barangay={form.barangay}
        selectedIds={form.farmer_ids}
        onConfirm={(ids) => { setForm((f) => ({ ...f, farmer_ids: ids })); if (submitted) setErrors((er) => ({ ...er, farmer_ids: undefined })); }}
      />
    </>
  );
}
