"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Shield, KeyRound, CheckCircle2, X } from "lucide-react";
import type { UserRole } from "@/lib/auth";

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
      <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center shadow-sm">
        <Shield size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Super Admin access required.</p>
      </div>
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
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="rounded-full bg-green-100 p-2">
          <Shield size={18} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800">User Management</h2>
          <p className="text-xs text-gray-400">Manage accounts and reset passwords</p>
        </div>
      </div>

      {/* Success toast */}
      {successUser && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2">
          <CheckCircle2 size={16} className="text-green-600" />
          <p className="text-sm text-green-700">
            Password reset successfully for <span className="font-semibold">{successUser}</span>.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">Username</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">Display Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">Barangay</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => {
              const style = ROLE_STYLES[u.role];
              const isResetting = resettingUser === u.username;

              return (
                <tr key={u.username} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-6 py-3 font-medium text-gray-700">{u.username}</td>
                  <td className="px-6 py-3 text-gray-600">{u.displayName}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{u.barangay || "---"}</td>
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
                            className="w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                          <input
                            type="password"
                            placeholder="Confirm"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                          <button
                            onClick={() => handleReset(u.username)}
                            disabled={loading}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {loading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelReset}
                            className="rounded-lg p-1.5 hover:bg-gray-100 transition"
                          >
                            <X size={14} className="text-gray-400" />
                          </button>
                        </div>
                      </div>
                    ) : successUser === u.username ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                        <CheckCircle2 size={14} /> Reset!
                      </span>
                    ) : (
                      <button
                        onClick={() => openReset(u.username)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition"
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
    </div>
  );
}
