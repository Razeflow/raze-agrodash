"use client";
import { useState } from "react";
import { X, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Props = { open: boolean; onClose: () => void };

export default function PasswordChangeDialog({ open, onClose }: Props) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setLoading(true);
    try {
      const result = await changePassword(current, newPw, confirmPw);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setCurrent("");
          setNewPw("");
          setConfirmPw("");
          onClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to change password.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setCurrent("");
    setNewPw("");
    setConfirmPw("");
    setError("");
    setSuccess(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-100 p-2">
              <KeyRound size={18} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Change Password</h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 size={48} className="text-green-500" />
            <p className="text-sm font-semibold text-green-700">Password changed successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Current Password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="Min 4 characters"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="Re-enter new password"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
