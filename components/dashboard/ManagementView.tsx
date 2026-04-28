"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { BARANGAYS } from "@/lib/data";
import { MapPin, KeyRound, CheckCircle2, X, Shield, AlertTriangle, UserCheck } from "lucide-react";
import BentoCard from "@/components/ui/BentoCard";

export default function ManagementView() {
  const { allUsers, resetUserPassword, isAdminOrAbove } = useAuth();

  const [resettingBarangay, setResettingBarangay] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [successBarangay, setSuccessBarangay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Map barangay → its BARANGAY_USER (if any)
  const userByBarangay = useMemo(() => {
    const map = new Map<string, typeof allUsers[number]>();
    for (const u of allUsers) {
      if (u.role === "BARANGAY_USER" && u.barangay) {
        map.set(u.barangay, u);
      }
    }
    return map;
  }, [allUsers]);

  const assignedCount = useMemo(
    () => BARANGAYS.filter((b) => userByBarangay.has(b)).length,
    [userByBarangay],
  );

  if (!isAdminOrAbove) {
    return (
      <BentoCard>
        <div className="text-center py-8">
          <Shield size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Admin access required.</p>
        </div>
      </BentoCard>
    );
  }

  function openReset(brgy: string) {
    setResettingBarangay(brgy);
    setNewPw("");
    setConfirmPw("");
    setError("");
  }

  function cancelReset() {
    setResettingBarangay(null);
    setNewPw("");
    setConfirmPw("");
    setError("");
  }

  async function handleReset(brgy: string, username: string) {
    setError("");
    if (!newPw || !confirmPw) { setError("Both fields are required."); return; }
    if (newPw.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const ok = await resetUserPassword(username, newPw);
      if (ok) {
        setSuccessBarangay(brgy);
        cancelReset();
        setTimeout(() => setSuccessBarangay(null), 2500);
      } else {
        setError("Password reset is not available right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up delay-1 space-y-5">
      {/* Header */}
      <BentoCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Barangay Access
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {assignedCount}/{BARANGAYS.length} barangays have a portal user · admin only
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100/60 bg-amber-50/60 px-4 py-2 text-[11px] text-amber-800 max-w-md">
            <p className="font-semibold flex items-center gap-1.5"><Shield size={12} /> Passwords are hashed</p>
            <p className="text-amber-700/90">Plaintext passwords cannot be displayed. Use Reset password to set a new one and share it with the barangay user out-of-band.</p>
          </div>
        </div>
      </BentoCard>

      {/* Barangay grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {BARANGAYS.map((brgy) => {
          const u = userByBarangay.get(brgy);
          const isResetting = resettingBarangay === brgy;
          const justSucceeded = successBarangay === brgy;

          return (
            <div
              key={brgy}
              className={`rounded-[2rem] bg-white/70 backdrop-blur-xl border shadow-lg p-4 transition-all ${
                u ? "border-white/40" : "border-amber-200/60"
              } ${isResetting ? "ring-2 ring-emerald-300" : ""}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-2xl ${u ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                  <MapPin size={14} />
                </div>
                <span className="text-sm font-bold text-slate-800 truncate flex-1">{brgy}</span>
                {u ? (
                  <span className="inline-flex items-center gap-1 rounded-[1rem] bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    <UserCheck size={10} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-[1rem] bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                    <AlertTriangle size={10} /> None
                  </span>
                )}
              </div>

              {u ? (
                <>
                  <div className="space-y-1 mb-3">
                    <div className="rounded-xl bg-slate-50/70 border border-slate-100 px-2.5 py-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Username</p>
                      <p className="font-mono text-xs font-bold text-slate-800 truncate">{u.username}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50/70 border border-slate-100 px-2.5 py-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Display name</p>
                      <p className="text-xs text-slate-700 truncate">{u.displayName}</p>
                    </div>
                  </div>

                  {justSucceeded && (
                    <div className="mb-2 flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-2 py-1">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-700">Password reset!</span>
                    </div>
                  )}

                  {isResetting ? (
                    <div className="space-y-2">
                      {error && <p className="text-[10px] text-red-500">{error}</p>}
                      <input
                        type="password"
                        autoFocus
                        placeholder="New password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/60 bg-white/70 px-2.5 py-1.5 text-xs focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/60 bg-white/70 px-2.5 py-1.5 text-xs focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        onKeyDown={(e) => { if (e.key === "Enter") handleReset(brgy, u.username); }}
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleReset(brgy, u.username)}
                          disabled={loading}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelReset}
                          className="rounded-xl border border-slate-200 px-2 py-1.5 hover:bg-slate-50 transition"
                          title="Cancel"
                        >
                          <X size={12} className="text-slate-500" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openReset(brgy)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
                    >
                      <KeyRound size={12} /> Reset password
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  No portal user assigned. Create one in the <span className="font-semibold">Users</span> tab and set their barangay to {brgy}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
