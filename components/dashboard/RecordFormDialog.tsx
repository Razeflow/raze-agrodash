"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Users, CheckCircle2, AlertCircle, History, FileText } from "lucide-react";
import type { AgriRecord } from "@/lib/data";
import {
  BARANGAYS,
  COMMODITY_OPTIONS,
  SUB_TYPES,
  getCurrentPHPeriod,
  MONTH_NAMES,
  CALAMITY_SUB_CATEGORIES,
  CALAMITY_SUB_CATEGORY_LABELS,
  LIFECYCLE_STATUSES,
  LIFECYCLE_STATUS_LABELS,
  type CalamitySubCategory,
  type LifecycleStatus,
} from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";
import FarmerSelectDialog from "./FarmerSelectDialog";
import { recordFormSchema, RECORD_LIMITS, zodIssuesToErrors, type RecordFormInput } from "@/lib/validations";
import { sortBy } from "@/lib/sort";
import { commodityGroupForCommodity } from "@/lib/domain/commodity";
import { recordStatus } from "@/lib/domain/metrics";
import { calculateRemainingLandAssetHa } from "@/lib/domain/allocation";
import { validateDomainRecord, formatDomainIssues } from "@/lib/domain/validation";
import {
  RECORD_STATUSES,
  RECORD_STATUS_LABELS,
  RECORD_STATUS_DESCRIPTIONS,
  canTransition,
  type RecordStatus,
} from "@/lib/domain/status";
import StatusBadge from "./record-form/StatusBadge";
import CropFields from "./record-form/CropFields";
import FisheryFields from "./record-form/FisheryFields";
import LivestockFields from "./record-form/LivestockFields";
import { FieldError, FieldLabel, inputCls, inputErrCls } from "./record-form/Field";
import RecordTimeline from "./RecordTimeline";

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
  fishery_loss_pieces?: string;
  livestock_stocking_heads?: string;
  livestock_output_heads?: string;
  livestock_dead_heads?: string;
  calamity?: string;
  remarks?: string;
  lifecycle_status?: string;
  status?: string;
  farmer_asset_id?: string;
};

function getEmptyForm() {
  const { month, year } = getCurrentPHPeriod();
  const out: RecordFormInput = {
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
    fishery_loss_pieces: 0,
    livestock_stocking_heads: 0,
    livestock_output_heads: 0,
    livestock_dead_heads: 0,
    pests_diseases: "None",
    calamity: "None",
    calamity_sub_category: "None" as CalamitySubCategory,
    remarks: "",
    lifecycle_status: "planted" as LifecycleStatus,
    status: "active" as RecordStatus,
    farmer_asset_id: null,
  };
  return out;
}

/**
 * Phase 2: derive the legacy `lifecycle_status` from the canonical `status`
 * + numeric evidence so existing aggregators / DB constraints stay green.
 *
 *   active   → "planted" (no damage) | "damaged" (mid-season damage > 0)
 *   harvested → "harvested"
 *   damaged  → "total_loss"
 *   archived → preserve whatever the row had before (legacy column lacks an "archived" value)
 */
function deriveLifecycleFromStatus(
  status: RecordStatus,
  damageTotal: number,
  prevLifecycle: LifecycleStatus,
): LifecycleStatus {
  if (status === "harvested") return "harvested";
  if (status === "damaged") return "total_loss";
  if (status === "archived") {
    // Keep whatever was set before archiving — legacy column has no 'archived'.
    return prevLifecycle === "harvested" || prevLifecycle === "total_loss" ? prevLifecycle : "harvested";
  }
  return damageTotal > 0 ? "damaged" : "planted";
}

export default function RecordFormDialog({ open, onClose, mode, initialData, defaultBarangay }: Props) {
  const { addRecord, updateRecord, getFarmersByIds, farmerAssets, records } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();
  const { mounted, visible } = useAnimatedMount(open);
  const availableBarangays = useMemo(() => {
    if (isBarangayUser && userBarangay) return [userBarangay];
    return sortBy([...BARANGAYS], (b) => b);
  }, [isBarangayUser, userBarangay]);
  const [form, setForm] = useState<RecordFormInput>(getEmptyForm());
  const [farmerSelectOpen, setFarmerSelectOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // Phase Next: which tab is active. Only "timeline" is reachable in edit mode.
  const [activeTab, setActiveTab] = useState<"details" | "timeline">("details");

  useEffect(() => {
    if (open) {
      setSuccessMsg(null);
      setErrorMsg(null);
      setErrors({});
      setSubmitted(false);
      // Always land on Details when the dialog (re)opens.
      setActiveTab("details");
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
          fishery_loss_pieces: Number(initialData.fishery_loss_pieces ?? 0),
          livestock_stocking_heads: Number(initialData.livestock_stocking_heads ?? 0),
          livestock_output_heads: Number(initialData.livestock_output_heads ?? 0),
          livestock_dead_heads: Number(initialData.livestock_dead_heads ?? 0),
          pests_diseases: initialData.pests_diseases,
          calamity: initialData.calamity,
          calamity_sub_category: initialData.calamity_sub_category ?? "None",
          remarks: initialData.remarks,
          lifecycle_status: initialData.lifecycle_status ?? "planted",
          status: recordStatus(initialData as any),
          farmer_asset_id: initialData.farmer_asset_id ?? null,
        });
      } else {
        const empty = getEmptyForm();
        setForm({ ...empty, barangay: defaultBarangay || (isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]) });
      }
    }
  }, [open, mode, initialData, defaultBarangay, isBarangayUser, userBarangay]);

  // The status that's currently *saved* (used to gate which transitions the dropdown
  // offers). For edit mode it's the row's stored status; for add mode there's no
  // saved row yet so anything reachable from "active" is allowed.
  const savedStatus: RecordStatus = useMemo(() => {
    if (mode === "edit" && initialData) return recordStatus(initialData as any);
    return "active";
  }, [mode, initialData]);

  // ── Phase C: LAND asset selector (CROP-only, optional) ──────────────────
  // All hooks below must run on every render — keep them above the early
  // `if (!mounted) return null` guard further down.
  const groupForHooks = commodityGroupForCommodity(form.commodity as any);
  const eligibleLandAssets = useMemo(() => {
    if (groupForHooks !== "CROP") return [];
    if (form.farmer_ids.length === 0) return [];
    const farmerIdSet = new Set(form.farmer_ids);
    return farmerAssets
      .filter((a) => a.category === "planting_area")
      .filter((a) => farmerIdSet.has(a.farmer_id))
      .filter((a) => (a.area_hectares ?? 0) > 0)
      .sort((a, b) => (a.parcel_label || "").localeCompare(b.parcel_label || ""));
  }, [farmerAssets, form.farmer_ids, groupForHooks]);

  const selectedAsset = useMemo(
    () => (form.farmer_asset_id ? farmerAssets.find((a) => a.id === form.farmer_asset_id) ?? null : null),
    [farmerAssets, form.farmer_asset_id],
  );

  // Remaining ha on the currently selected asset, excluding *this* record's
  // own contribution when editing — otherwise edit-time validation would
  // double-count its own area against itself.
  const remainingOnSelectedAsset = useMemo(() => {
    if (!selectedAsset) return null;
    return calculateRemainingLandAssetHa(selectedAsset, records, {
      excludeRecordId: mode === "edit" ? initialData?.id : undefined,
    });
  }, [selectedAsset, records, mode, initialData?.id]);

  // Cascade-clear: drop farmer_asset_id when the selection becomes invalid
  // (commodity left CROP, or asset's owner is no longer among the farmers).
  useEffect(() => {
    if (!form.farmer_asset_id) return;
    if (groupForHooks !== "CROP") {
      setForm((f) => ({ ...f, farmer_asset_id: null }));
      return;
    }
    const stillEligible = eligibleLandAssets.some((a) => a.id === form.farmer_asset_id);
    if (!stillEligible) setForm((f) => ({ ...f, farmer_asset_id: null }));
  }, [form.farmer_asset_id, eligibleLandAssets, groupForHooks]);

  if (!mounted) return null;

  const isFishery = form.commodity === "Fishery";
  const isLivestock = form.commodity === "Livestock";
  const group = groupForHooks;
  const isCorn = form.commodity === "Corn";
  const subTypes = SUB_TYPES[form.commodity] || [];
  const linkedFarmers = getFarmersByIds(form.farmer_ids);

  const archived = form.status === "archived";
  const finalized = form.status === "harvested" || form.status === "damaged";
  // UX rule: finalized records lock numeric evidence; archived locks everything.
  const lockEvidenceFields = archived || finalized;

  // Generate year options (current PH year -2 to +1)
  const { year: currentYear } = getCurrentPHPeriod();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  function validate(): FormErrors {
    const result = recordFormSchema.safeParse(form);
    const errs: FormErrors = result.success
      ? {}
      : (() => {
          const fieldErrors = zodIssuesToErrors(result.error.issues);
          const e: FormErrors = { ...(fieldErrors as FormErrors) };
          // Collapse period_month / period_year errors under the shared `period` key
          // so the existing single-row "Reporting period is required" UI still works.
          if (fieldErrors.period_month || fieldErrors.period_year) {
            e.period = fieldErrors.period_month || fieldErrors.period_year;
          }
          return e;
        })();

    // Domain-layer enforcement: commodity field isolation + status evidence.
    // Runs after Zod so shape errors are caught first. First error per field
    // wins; Zod errors take precedence over domain errors on the same field.
    // Cast: STATUS_VALUES is widened to string for Zod's enum, but the runtime
    // value is always a RecordStatus.
    const domain = validateDomainRecord({
      record: { ...form, status: form.status as RecordStatus },
      status: form.status as RecordStatus,
    });
    if (!domain.ok) {
      const { fieldErrors: domainFieldErrors } = formatDomainIssues(domain.issues);
      for (const [key, msg] of Object.entries(domainFieldErrors)) {
        if (!(key in errs) || !errs[key as keyof FormErrors]) {
          (errs as Record<string, string>)[key] = msg;
        }
      }
    }

    // Phase D: require farmer_asset_id for NEW CROP records when the farmer
    // already has at least one eligible planting-area asset on file. Edits of
    // existing records are not gated, so legacy rows stay editable.
    if (
      mode === "add" &&
      group === "CROP" &&
      form.farmer_ids.length > 0 &&
      eligibleLandAssets.length > 0 &&
      !form.farmer_asset_id
    ) {
      errs.farmer_asset_id = "Pick the land asset this crop cycle is planted on.";
    }
    return errs;
  }

  function handleCommodityChange(commodity: AgriRecord["commodity"]) {
    const subs = SUB_TYPES[commodity] || [];
    setForm((f) => ({
      ...f,
      commodity,
      sub_category: commodity === "Corn" ? "Corn" : subs[0] || "",
      planting_area_hectares: commodity === "Fishery" || commodity === "Livestock" ? 0 : f.planting_area_hectares,
      harvesting_output_bags: commodity === "Fishery" || commodity === "Livestock" ? 0 : f.harvesting_output_bags,
      damage_pests_hectares: commodity === "Fishery" || commodity === "Livestock" ? 0 : f.damage_pests_hectares,
      damage_calamity_hectares: commodity === "Fishery" || commodity === "Livestock" ? 0 : f.damage_calamity_hectares,
      stocking: commodity === "Fishery" ? f.stocking : 0,
      harvesting_fishery: commodity === "Fishery" ? f.harvesting_fishery : 0,
      fishery_loss_pieces: commodity === "Fishery" ? f.fishery_loss_pieces : 0,
      livestock_stocking_heads: commodity === "Livestock" ? f.livestock_stocking_heads : 0,
      livestock_output_heads: commodity === "Livestock" ? f.livestock_output_heads : 0,
      livestock_dead_heads: commodity === "Livestock" ? f.livestock_dead_heads : 0,
      calamity: commodity === "Fishery" || commodity === "Livestock" ? "None" : f.calamity,
      calamity_sub_category: commodity === "Fishery" || commodity === "Livestock" ? "None" : f.calamity_sub_category,
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

    // Phase 2: `status` is the canonical contract; legacy `lifecycle_status`
    // is derived so existing aggregators / DB constraints stay green.
    const damageTotal =
      group === "CROP"
        ? form.damage_pests_hectares + form.damage_calamity_hectares
        : group === "FISHERY"
          ? (form.fishery_loss_pieces ?? 0)
          : (form.livestock_dead_heads ?? 0);
    const prevLifecycle = (mode === "edit" && initialData?.lifecycle_status) || "planted";
    const derivedLifecycle = deriveLifecycleFromStatus(
      form.status as RecordStatus,
      damageTotal,
      prevLifecycle as LifecycleStatus,
    );

    const data = {
      ...form,
      sub_category: isCorn ? "Corn" : form.sub_category,
      farmer_ids: form.farmer_ids,
      period_month: form.period_month,
      period_year: form.period_year,
      commodity: form.commodity as AgriRecord["commodity"],
      lifecycle_status: derivedLifecycle,
      status: form.status as RecordStatus,
      calamity_sub_category: form.calamity_sub_category as CalamitySubCategory,
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
            <div className="flex items-center gap-2">
              <StatusBadge status={form.status as RecordStatus} />
              <button onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Phase Next: Details / Timeline tab strip. Only shown in edit mode
              because there is no record yet in add mode (nothing to show a
              timeline for). The Timeline panel is lazy-loaded — it only
              fetches when its tab becomes active. */}
          {mode === "edit" && initialData && (
            <div className="mb-5 inline-flex rounded-full bg-slate-100/70 p-1 text-xs font-medium" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "details"}
                onClick={() => setActiveTab("details")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                  activeTab === "details"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <FileText size={12} /> Details
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "timeline"}
                onClick={() => setActiveTab("timeline")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                  activeTab === "timeline"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <History size={12} /> Timeline
              </button>
            </div>
          )}

          {/* Timeline tab content. Mounted only when active so the fetch fires
              on tab open, not on dialog open. */}
          {mode === "edit" && initialData && activeTab === "timeline" && (
            <RecordTimeline recordId={initialData.id} active={true} />
          )}

          {/* Everything below this point is the Details tab — banners + form.
              Wrapped in a fragment so the activeTab gate covers all of it. */}
          {activeTab === "details" && (
          <>
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

          {archived && (
            <div className="mb-4 rounded-2xl bg-slate-50 border border-slate-200/70 px-4 py-2.5 text-sm font-medium text-slate-600">
              This record is archived and is read-only.
            </div>
          )}
          {!archived && finalized && (
            <div className="mb-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/50 px-4 py-2.5 text-sm font-medium text-emerald-700">
              Finalized record: numeric evidence fields are locked for reporting integrity.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reporting Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Reporting Month</FieldLabel>
                <select
                  className={errors.period ? inputErrCls : inputCls}
                  value={form.period_month}
                  disabled={archived}
                  onChange={(e) => { setForm((f) => ({ ...f, period_month: parseInt(e.target.value) })); if (submitted) setErrors((er) => ({ ...er, period: undefined })); }}
                >
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Reporting Year</FieldLabel>
                <select
                  className={errors.period ? inputErrCls : inputCls}
                  value={form.period_year}
                  disabled={archived}
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
                <FieldLabel required>Barangay</FieldLabel>
                {isBarangayUser ? (
                  <div className={inputCls + " flex items-center gap-2 bg-white/30 cursor-not-allowed"}>
                    <span className="text-gray-700 font-medium">{userBarangay}</span>
                    <span className="ml-auto text-[10px] text-gray-400">🔒 Assigned</span>
                  </div>
                ) : (
                  <select
                    className={inputCls}
                    disabled={archived}
                    value={form.barangay}
                    onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value, farmer_ids: [] }))}
                  >
                    {availableBarangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
              <div>
                <FieldLabel required>Commodity</FieldLabel>
                <select
                  disabled={archived}
                  className={errors.commodity ? inputErrCls : inputCls}
                  value={form.commodity}
                  onChange={(e) => handleCommodityChange(e.target.value as AgriRecord["commodity"])}
                >
                  {COMMODITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.commodity && <p className={errTextCls}><AlertCircle size={11} /> {errors.commodity}</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  Group: <span className="font-black text-slate-600">{group}</span>
                </p>
              </div>
            </div>

            {/* Record status (Phase 2 canonical lifecycle). */}
            <div>
              <FieldLabel required>Status</FieldLabel>
              <select
                className={errors.status ? inputErrCls : inputCls}
                value={form.status}
                disabled={archived}
                onChange={(e) => {
                  const next = e.target.value as RecordStatus;
                  setForm((f) => ({ ...f, status: next }));
                  if (submitted) setErrors((er) => ({ ...er, status: undefined }));
                }}
              >
                {RECORD_STATUSES.map((s) => {
                  const allowed = canTransition(savedStatus, s);
                  return (
                    <option key={s} value={s} disabled={!allowed}>
                      {RECORD_STATUS_LABELS[s]}{!allowed ? " — not allowed from current status" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {RECORD_STATUS_DESCRIPTIONS[form.status as RecordStatus]}
              </p>
              {errors.status && <p className={errTextCls}><AlertCircle size={11} /> {errors.status}</p>}
            </div>

            {/* Variety */}
            {!isCorn && subTypes.length > 0 && (
              <div>
                <FieldLabel>Variety / Type</FieldLabel>
                <select
                  className={inputCls}
                  disabled={archived}
                  value={form.sub_category}
                  onChange={(e) => setForm((f) => ({ ...f, sub_category: e.target.value }))}
                >
                  {subTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Farmer Selection */}
            <div>
              <FieldLabel required>Farmers / Fisherfolks</FieldLabel>
              <button
                type="button"
                onClick={() => setFarmerSelectOpen(true)}
                disabled={archived}
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
                      <button
                        type="button"
                        disabled={archived}
                        onClick={() => { setForm((prev) => ({ ...prev, farmer_ids: prev.farmer_ids.filter((id) => id !== f.id) })); if (submitted) setErrors((er) => ({ ...er, farmer_ids: undefined })); }}
                        className="ml-1 hover:text-red-500 disabled:opacity-40"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Phase C/D: Land asset selector — CROP only, requires farmers picked. */}
            {/* Required for NEW crop records when an eligible asset exists (Phase D). */}
            {group === "CROP" && form.farmer_ids.length > 0 && (
              <div>
                <FieldLabel required={mode === "add" && eligibleLandAssets.length > 0}>
                  Land asset{mode === "edit" ? " (optional)" : eligibleLandAssets.length === 0 ? " (optional — none on file)" : ""}
                </FieldLabel>
                <select
                  className={errors.farmer_asset_id ? inputErrCls : inputCls}
                  disabled={archived || eligibleLandAssets.length === 0}
                  value={form.farmer_asset_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, farmer_asset_id: v ? v : null }));
                    if (submitted) setErrors((er) => ({ ...er, farmer_asset_id: undefined }));
                  }}
                >
                  <option value="">— Household allocation (no specific lot) —</option>
                  {eligibleLandAssets.map((a) => {
                    const label = a.parcel_label?.trim() || `Lot ${a.id.slice(0, 8)}`;
                    return (
                      <option key={a.id} value={a.id}>
                        {label} — {Number(a.area_hectares).toFixed(2)} ha total
                      </option>
                    );
                  })}
                </select>
                {errors.farmer_asset_id && (
                  <p className={errTextCls}><AlertCircle size={11} /> {errors.farmer_asset_id}</p>
                )}
                {eligibleLandAssets.length === 0 ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    No planting-area assets on file for the selected farmer(s). Add one in Farmer Assets to track per-lot allocation.
                  </p>
                ) : selectedAsset && remainingOnSelectedAsset != null ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Remaining on this lot:{" "}
                    <span className={remainingOnSelectedAsset < (form.planting_area_hectares ?? 0) ? "font-bold text-red-600" : "font-bold text-emerald-700"}>
                      {remainingOnSelectedAsset.toFixed(2)} ha
                    </span>{" "}
                    of {Number(selectedAsset.area_hectares).toFixed(2)} ha total
                    {mode === "edit" ? " (this record's current allocation excluded)" : ""}.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Pick the lot this cycle is planted on.
                  </p>
                )}
              </div>
            )}

            {/* Crop fields (hidden for Fishery + Livestock) */}
            {!isFishery && !isLivestock && (
              <CropFields
                form={form}
                setForm={(updater) => {
                  setForm((prev) => {
                    const next = typeof updater === "function" ? (updater as any)(prev) : updater;
                    return next;
                  });
                }}
                errors={errors as any}
                locked={lockEvidenceFields}
              />
            )}

            {/* Fishery fields (pieces) */}
            {isFishery && (
              <FisheryFields
                form={form}
                setForm={(updater) => {
                  setForm((prev) => {
                    const next = typeof updater === "function" ? (updater as any)(prev) : updater;
                    return next;
                  });
                }}
                errors={errors as any}
                locked={lockEvidenceFields}
              />
            )}

            {/* Livestock fields (heads) */}
            {isLivestock && (
              <LivestockFields
                form={form}
                setForm={(updater) => {
                  setForm((prev) => {
                    const next = typeof updater === "function" ? (updater as any)(prev) : updater;
                    return next;
                  });
                }}
                errors={errors as any}
                locked={lockEvidenceFields}
              />
            )}

            {/* Pests & Calamity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Pests & Diseases</FieldLabel>
                <input
                  disabled={archived}
                  className={inputCls}
                  value={form.pests_diseases}
                  onChange={(e) => setForm((f) => ({ ...f, pests_diseases: e.target.value }))}
                  placeholder="e.g. Rice Blast, Stem Borer or None"
                />
              </div>
              <div>
                <FieldLabel>Calamity type</FieldLabel>
                <select
                  className={inputCls}
                  value={form.calamity_sub_category}
                  disabled={archived || isFishery || isLivestock}
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
                <FieldLabel>Calamity event or name</FieldLabel>
                <input
                  className={errors.calamity ? inputErrCls : inputCls}
                  value={form.calamity}
                  disabled={archived || isFishery || isLivestock}
                  onChange={(e) => { setForm((f) => ({ ...f, calamity: e.target.value })); if (submitted) setErrors((er) => ({ ...er, calamity: undefined })); }}
                  placeholder="e.g. Typhoon Egay, barangay sitio — or None"
                />
                {errors.calamity && <p className={errTextCls}><AlertCircle size={11} /> {errors.calamity}</p>}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <FieldLabel>Remarks (optional)</FieldLabel>
              <textarea
                disabled={archived}
                className="w-full rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="w-full sm:w-auto rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-white/70 transition">{mode === "add" ? "Close" : "Cancel"}</button>
              {!archived ? (
                <button type="submit" disabled={saving} className={`w-full sm:w-auto rounded-[1.5rem] px-5 py-2.5 sm:py-2 text-sm font-black text-white shadow-lg transition ${saving ? "bg-slate-400 cursor-not-allowed shadow-slate-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"}`}>
                  {saving ? "Saving…" : mode === "add" ? "Add Record" : "Save Changes"}
                </button>
              ) : null}
            </div>
          </form>
          </>
          )}
        </div>
        </div>
      </div>
      </DialogPortal>

      <FarmerSelectDialog
        open={farmerSelectOpen}
        onClose={() => setFarmerSelectOpen(false)}
        barangay={form.barangay}
        selectedIds={form.farmer_ids}
        onConfirm={(ids) => {
          if (archived) return;
          setForm((f) => ({ ...f, farmer_ids: ids }));
          if (submitted) setErrors((er) => ({ ...er, farmer_ids: undefined }));
        }}
      />
    </>
  );
}
