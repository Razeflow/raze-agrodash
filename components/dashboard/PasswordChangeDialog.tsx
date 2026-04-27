"use client";
import { useState } from "react";
import { X, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";

type Props = { open: boolean; onClose: () => void };

export default function PasswordChangeDialog({ open, onClose }: Props) {
  const { changePassword } = useAuth();
  const { mounted, visible } = useAnimatedMount(open);
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!mounted) return null;

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

  const inputCls = "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";
  const labelCls = "mb-1 block text-xs font-black uppercase tracking-widest text-slate-500";

  return (
    <DialogPortal>
    <div className="fixed inset-0 lg:left-24 z-50 overflow-y-auto">
      <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={handleClose} />
      <div className="flex min-h-full items-center justify-center p-4">
      <div className={`relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-green-100">
              <KeyRound size={18} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Change Password</h2>
          </div>
          <button onClick={handleClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
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
              <div className="rounded-2xl bg-red-50/70 border border-red-200/50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className={labelCls}>Current Password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputCls}
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <label className={labelCls}>New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className={inputCls}
                placeholder="Min 4 characters"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={inputCls}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-[1.5rem] bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loading ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
      </div>
    </div>
    </DialogPortal>
  );
}
