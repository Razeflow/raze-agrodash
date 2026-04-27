"use client";
import { useState, useEffect, useMemo } from "react";
import { X, CheckCircle2, AlertTriangle, Camera } from "lucide-react";
import type { Farmer } from "@/lib/data";
import { BARANGAYS, CIVIL_STATUS_OPTIONS, ORG_TYPE_LABELS } from "@/lib/data";
import { useAgriData, type AddFarmerInput } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";
import { uploadFarmerPhoto } from "@/lib/farmer-photo";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initialData?: Farmer;
  defaultBarangay?: string;
};

export default function FarmerFormDialog({ open, onClose, mode, initialData, defaultBarangay }: Props) {
  const {
    addFarmer,
    updateFarmer,
    farmersByBarangay,
    households,
    organizations,
    getOrganizationIdsForFarmer,
    saveFarmerOrganizations,
  } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();
  const { mounted, visible } = useAnimatedMount(open);
  const availableBarangays = isBarangayUser && userBarangay ? [userBarangay] : BARANGAYS;

  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [barangay, setBarangay] = useState<string>(isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]);
  const [householdId, setHouseholdId] = useState<string>("");
  const [rsbsaNumber, setRsbsaNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(0);
  const [dupeWarning, setDupeWarning] = useState<string | null>(null);
  const [forceAdd, setForceAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdHead, setIsHouseholdHead] = useState(true);

  const householdsInBarangay = useMemo(
    () => households.filter((h) => h.barangay === barangay),
    [households, barangay],
  );

  const orgsForBarangay = useMemo(
    () => organizations.filter((o) => !o.barangay || o.barangay === barangay),
    [organizations, barangay],
  );

  useEffect(() => {
    if (open) {
      setSuccessMsg(null);
      setErrorMsg(null);
      setAddCount(0);
      setDupeWarning(null);
      setForceAdd(false);
      setPhotoFile(null);
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setGender(initialData.gender);
        setBarangay(initialData.barangay);
        setHouseholdId(initialData.household_id || "");
        setRsbsaNumber(initialData.rsbsa_number || "");
        setBirthDate(initialData.birth_date || "");
        setCivilStatus(initialData.civil_status || "");
        setPhotoUrl(initialData.photo_url);
        setSelectedOrgIds(getOrganizationIdsForFarmer(initialData.id));
        setIsHouseholdHead(initialData.is_household_head);
        setNewHouseholdName("");
      } else {
        setName("");
        setGender("Male");
        setBarangay(defaultBarangay || (isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]));
        setHouseholdId("");
        setRsbsaNumber("");
        setBirthDate("");
        setCivilStatus("");
        setPhotoUrl(null);
        setSelectedOrgIds([]);
        setNewHouseholdName("");
        setIsHouseholdHead(true);
      }
    }
  }, [open, mode, initialData, defaultBarangay, isBarangayUser, userBarangay, getOrganizationIdsForFarmer]);

  if (!mounted) return null;

  function toggleOrg(id: string) {
    setSelectedOrgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg(null);

    const basePayload = {
      name: name.trim(),
      gender,
      barangay,
      household_id: householdId || null,
      is_household_head: !householdId ? true : isHouseholdHead,
      rsbsa_number: rsbsaNumber.trim() || null,
      birth_date: birthDate.trim() || null,
      civil_status: civilStatus.trim() || null,
      photo_url: photoUrl,
    };

    if (mode === "edit" && initialData) {
      setSaving(true);
      try {
        const u1 = await updateFarmer(initialData.id, { ...basePayload, photo_url: photoUrl });
        if (!u1.ok) {
          setErrorMsg(u1.message);
          return;
        }
        if (photoFile) {
          const url = await uploadFarmerPhoto(initialData.id, photoFile);
          if (url) {
            const u2 = await updateFarmer(initialData.id, { ...basePayload, photo_url: url });
            if (!u2.ok) {
              setErrorMsg(u2.message);
              return;
            }
            setPhotoUrl(url);
          }
        }
        const orgRes = await saveFarmerOrganizations(initialData.id, selectedOrgIds);
        if (!orgRes.ok) {
          setErrorMsg(orgRes.message);
          return;
        }
        onClose();
      } catch (err) {
        console.error("[FarmerForm] edit error", err);
        setErrorMsg(err instanceof Error ? err.message : "Unexpected error while saving.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!forceAdd) {
      const trimmed = name.trim().toLowerCase();
      const existing = (farmersByBarangay[barangay] || []).find((f) => f.name.trim().toLowerCase() === trimmed);
      if (existing) {
        setDupeWarning(existing.name);
        setForceAdd(true);
        return;
      }
    }

    setSaving(true);
    try {
      const addPayload: AddFarmerInput = householdId
        ? basePayload
        : { ...basePayload, new_household_display_name: newHouseholdName.trim() || null };
      const result = await addFarmer(addPayload);
      if (!result.ok) {
        setErrorMsg(result.message);
        return;
      }
      const newId = result.id;
      if (photoFile) {
        const url = await uploadFarmerPhoto(newId, photoFile);
        if (url) {
          const uPh = await updateFarmer(newId, {
            ...basePayload,
            household_id: householdId || null,
            photo_url: url,
          });
          if (!uPh.ok) {
            setErrorMsg(uPh.message);
            return;
          }
          setPhotoUrl(url);
        }
      }
      const orgRes = await saveFarmerOrganizations(newId, selectedOrgIds);
      if (!orgRes.ok) {
        setErrorMsg(orgRes.message);
        return;
      }

      setErrorMsg(null);
      setSuccessMsg("Farmer registered!");
      setAddCount((c) => c + 1);
      setName("");
      setDupeWarning(null);
      setForceAdd(false);
      setPhotoFile(null);
      setRsbsaNumber("");
      setBirthDate("");
      setCivilStatus("");
      setHouseholdId("");
      setNewHouseholdName("");
      setIsHouseholdHead(true);
      setSelectedOrgIds([]);
      setTimeout(() => setSuccessMsg(null), 1500);
    } catch (err) {
      console.error("[FarmerForm] add error", err);
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error while registering.");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = photoFile ? URL.createObjectURL(photoFile) : photoUrl;

  const inputCls =
    "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-500 mb-1";

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-50 overflow-y-auto">
        <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {mode === "add" ? "Register Farmer" : "Edit Farmer"}
              </h2>
              <button type="button" onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
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
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {dupeWarning && (
              <div className="mb-4 rounded-2xl bg-amber-50/70 border border-amber-200/50 px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                <span>
                  A farmer named <strong>&quot;{dupeWarning}&quot;</strong> already exists in {barangay}. Click &quot;Add
                  Anyway&quot; to proceed.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Camera size={28} />
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setPhotoFile(f || null);
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label className={labelCls}>Full Name</label>
                    <input
                      className={inputCls}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDupeWarning(null);
                        setForceAdd(false);
                      }}
                      placeholder="e.g. Juan Dela Cruz"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as "Male" | "Female")}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Barangay</label>
                      {isBarangayUser ? (
                        <div className={inputCls + " flex items-center gap-2 bg-white/30 cursor-not-allowed"}>
                          <span className="text-gray-700 font-medium">{userBarangay}</span>
                          <span className="ml-auto text-[10px] text-gray-400">🔒 Assigned</span>
                        </div>
                      ) : (
                        <select
                          className={inputCls}
                          value={barangay}
                          onChange={(e) => {
                            setBarangay(e.target.value);
                            setHouseholdId("");
                          }}
                        >
                          {availableBarangays.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Household</label>
                <select
                  className={inputCls}
                  value={householdId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHouseholdId(v);
                    if (!v) {
                      setIsHouseholdHead(true);
                      setNewHouseholdName("");
                    }
                  }}
                >
                  <option value="">Create new household</option>
                  {householdsInBarangay.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.display_name || "Unnamed"} · {h.farming_area_hectares ?? 0} ha shared
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">Members share farming area and RFFA notes on the household.</p>
              </div>

              {mode === "add" && !householdId && (
                <div>
                  <label className={labelCls}>New household name</label>
                  <input
                    className={inputCls}
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    placeholder={`Defaults to "Household — ${name.trim() || "…"}" if empty`}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">The first person registered becomes household head.</p>
                </div>
              )}

              {mode === "add" && householdId && (
                <div>
                  <p className={labelCls}>Role in this household</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="hhRole"
                        checked={isHouseholdHead}
                        onChange={() => setIsHouseholdHead(true)}
                      />
                      Head of household
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="hhRole"
                        checked={!isHouseholdHead}
                        onChange={() => setIsHouseholdHead(false)}
                      />
                      Member
                    </label>
                  </div>
                </div>
              )}

              {mode === "edit" && householdId && (
                <div>
                  <p className={labelCls}>Role in household</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="hhRoleEdit"
                        checked={isHouseholdHead}
                        onChange={() => setIsHouseholdHead(true)}
                      />
                      Head of household
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="hhRoleEdit"
                        checked={!isHouseholdHead}
                        onChange={() => setIsHouseholdHead(false)}
                      />
                      Member
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>RSBSA number</label>
                  <input className={inputCls} value={rsbsaNumber} onChange={(e) => setRsbsaNumber(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelCls}>Birth date</label>
                  <input className={inputCls} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Civil status</label>
                <select className={inputCls} value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)}>
                  <option value="">—</option>
                  {CIVIL_STATUS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Organization memberships (coops / associations)</label>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200/50 bg-white/40 p-3">
                  {orgsForBarangay.length === 0 ? (
                    <p className="text-xs text-slate-400">No organizations yet. Add some under Programs.</p>
                  ) : (
                    orgsForBarangay.map((o) => (
                      <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedOrgIds.includes(o.id)} onChange={() => toggleOrg(o.id)} />
                        <span>
                          {o.name}{" "}
                          <span className="text-xs text-slate-400">({ORG_TYPE_LABELS[o.org_type]})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {mode === "add" && addCount > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  {addCount} farmer{addCount !== 1 ? "s" : ""} registered this session
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition"
                >
                  {mode === "add" ? "Close" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-[1.5rem] px-5 py-2 text-sm font-black text-white shadow-lg transition ${
                    saving ? "bg-slate-400 cursor-not-allowed shadow-slate-200" : dupeWarning ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                  }`}
                >
                  {saving ? "Saving…" : mode === "edit" ? "Save Changes" : dupeWarning ? "Add Anyway" : "Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
