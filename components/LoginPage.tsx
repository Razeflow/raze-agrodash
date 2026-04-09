"use client";
import { useState } from "react";
import { Sprout, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const success = await login(username.trim(), password);
      if (!success) {
        setError("Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0F4F8]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-200">
            <Sprout size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-gray-800">
            Raze AgroDash
          </h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
            Municipal Agriculture Production Monitoring
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-[2.5rem] border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl">
          <h2 className="mb-1 text-xl font-extrabold tracking-tight text-gray-700">Sign In</h2>
          <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Enter your credentials to access the dashboard
          </p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200/50 bg-red-50/70 px-3 py-2 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full rounded-[1.5rem] border border-slate-200 bg-white/50 px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-[1.5rem] border border-slate-200 bg-white/50 px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <LogIn size={16} /> {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-center text-[10px] font-bold text-slate-300">
          Municipal Agriculture Office · Tubo, Abra · Region CAR
        </p>
      </div>
    </div>
  );
}
