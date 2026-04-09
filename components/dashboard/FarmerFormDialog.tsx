"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Farmer } from "@/lib/data";
import { BARANGAYS } from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initialData?: Farmer;
  defaultBarangay?: string;
};

export default function FarmerFormDialog({ open, onClose, mode, initialData, defaultBarangay }: Props) {
  const { addFarmer, updateFarmer, farmersByBarangay } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();
  const availableBarangays = isBarangayUser && userBarangay ? [userBarangay] : BARANGAYS;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [barangay, setBarangay] = useState<string>(isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(0);
  const [dupeWarning, setDupeWarning] = useState<string | null>(null);
  const [forceAdd, setForceAdd] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccessMsg(null);
      setAddCount(0);
      setDupeWarning(null);
      setForceAdd(false);
      if (mode === "edit" && initialData) {
        setName(initialData.name);
        setGender(initialData.gender);
        setBarangay(initialData.barangay);
      } else {
        setName("");
        setGender("Male");
        setBarangay(defaultBarangay || (isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0]));
      }
    }
  }, [open, mode, initialData, defaultBarangay, isBarangayUser, userBarangay]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "edit" && initialData) {
      updateFarmer(initialData.id, { name: name.trim(), gender, barangay });
      onClose();
    } else {
      // Anti-duplication check
      if (!forceAdd) {
        const trimmed = name.trim().toLowerCase();
        const existing = (farmersByBarangay[barangay] || []).find(
          (f) => f.name.trim().toLowerCase() === trimmed
        );
        if (existing) {
          setDupeWarning(existing.name);
          setForceAdd(true);
          return;
        }
      }
      addFarmer({ name: name.trim(), gender, barangay });
      setSuccessMsg("Farmer registered!");
      setAddCount(c => c + 1);
      setName("");
      setDupeWarning(null);
      setForceAdd(false);
      setTimeout(() => setSuccessMsg(null), 1500);
    }
  }

  const inputCls = "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {mode === "add" ? "Register Farmer" : "Edit Farmer"}
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

        {dupeWarning && (
          <div className="mb-4 rounded-2xl bg-amber-50/70 border border-amber-200/50 px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-amber-500" />
            <span>A farmer named <strong>&quot;{dupeWarning}&quot;</strong> already exists in {barangay}. Click &quot;Add Anyway&quot; to proceed.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setDupeWarning(null); setForceAdd(false); }} placeholder="e.g. Juan Dela Cruz" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                <select className={inputCls} value={barangay} onChange={(e) => setBarangay(e.target.value)}>
                  {availableBarangays.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
            </div>
          </div>
          {mode === "add" && addCount > 0 && (
            <p className="text-xs text-green-600 font-medium">{addCount} farmer{addCount !== 1 ? "s" : ""} registered this session</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition">{mode === "add" ? "Close" : "Cancel"}</button>
            <button type="submit" className={`rounded-[1.5rem] px-5 py-2 text-sm font-black text-white shadow-lg transition ${
              dupeWarning ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
            }`}>
              {mode === "edit" ? "Save Changes" : dupeWarning ? "Add Anyway" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
