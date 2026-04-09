"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Shield, KeyRound, CheckCircle2, X } from "lucide-react";
import type { UserRole } from "@/lib/auth";
import BentoCard from "@/components/ui/BentoCard";

const ROLE_STYLES: Record<UserRole, { label: string; bg: string; text: string }> = {
  SUPER_ADMIN:   { label: "Super Admin",   bg: "bg-red-100",    text: "text-red-700" },
  ADMIN:         { label: "Admin",          bg: "bg-purple-100", text: "text-purple-700" },
  BARANGAY_USER: { label: "Barangay User", bg: "bg-green-100",  text: "text-green-700" },
};

export default function UserManagement() {
  const { allUsers, resetUserPassword, isSuperAdmin } = useAuth();
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [successUser, setSuccessUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSuperAdmin) {
    return (
      <BentoCard>
        <div className="text-center py-4">
          <Shield size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Super Admin access required.</p>
        </div>
      </BentoCard>
    );
  }

  async function handleReset(username: string) {
    setError("");
    if (!newPw || !confirmPw) {
      setError("Both fields are required.");
      return;
    }
    if (newPw.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const ok = await resetUserPassword(username, newPw);
      if (ok) {
        setSuccessUser(username);
        setResettingUser(null);
        setNewPw("");
        setConfirmPw("");
        setError("");
        setTimeout(() => setSuccessUser(null), 2500);
      } else {
        setError("Password reset is not available at this time.");
      }
    } finally {
      setLoading(false);
    }
  }

  function openReset(username: string) {
    setResettingUser(username);
    setNewPw("");
    setConfirmPw("");
    setError("");
  }

  function cancelReset() {
    setResettingUser(null);
    setNewPw("");
    setConfirmPw("");
    setError("");
  }

  return (
    <BentoCard noPadding title="User Management" subtitle="System users & roles">
      {/* Success toast */}
      {successUser && (
        <div className="mx-6 mt-2 flex items-center gap-2 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 px-4 py-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm text-emerald-700">
            Password reset successfully for <span className="font-semibold">{successUser}</span>.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/30 bg-white/30">
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Username</th>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Display Name</th>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Barangay</th>
              <th className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => {
              const style = ROLE_STYLES[u.role];
              const isResetting = resettingUser === u.username;

              return (
                <tr key={u.username} className="border-b border-white/20 hover:bg-emerald-50/30 transition">
                  <td className="px-6 py-3 font-medium text-slate-700">{u.username}</td>
                  <td className="px-6 py-3 text-slate-600">{u.displayName}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-[1rem] px-2.5 py-0.5 text-xs font-bold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500">{u.barangay || "---"}</td>
                  <td className="px-6 py-3 text-right">
                    {isResetting ? (
                      <div className="flex flex-col items-end gap-2">
                        {error && (
                          <p className="text-xs text-red-500">{error}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            className="w-32 rounded-[1.5rem] border border-slate-200/50 bg-white/50 px-3 py-1.5 text-xs focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <input
                            type="password"
                            placeholder="Confirm"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-32 rounded-[1.5rem] border border-slate-200/50 bg-white/50 px-3 py-1.5 text-xs focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <button
                            onClick={() => handleReset(u.username)}
                            disabled={loading}
                            className="rounded-[1.5rem] bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            {loading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelReset}
                            className="rounded-[1.5rem] p-1.5 hover:bg-white/50 transition"
                          >
                            <X size={14} className="text-slate-400" />
                          </button>
                        </div>
                      </div>
                    ) : successUser === u.username ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 size={14} /> Reset!
                      </span>
                    ) : (
                      <button
                        onClick={() => openReset(u.username)}
                        className="inline-flex items-center gap-1.5 rounded-[1.5rem] border border-slate-200/50 px-3 py-1.5 text-xs text-slate-600 hover:bg-emerald-50/30 hover:text-emerald-700 hover:border-emerald-200 transition"
                      >
                        <KeyRound size={12} /> Reset Password
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
