"use client";
import { useState } from "react";
import { Leaf, LogIn, AlertCircle } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center" style={{ background: "#f0f4f0" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 shadow-lg">
            <Leaf size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Space Mono" }}>
            Raze AgroDash
          </h1>
          <p className="mt-1 text-xs text-gray-400">Municipal Agriculture Production Monitoring</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Sign In</h2>
          <p className="mb-5 text-xs text-gray-400">Enter your credentials to access the dashboard</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Username</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-green-400 focus:bg-white transition"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-green-400 focus:bg-white transition"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              <LogIn size={16} /> {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Municipal Agriculture Office · Tubo, Abra · Region CAR
        </p>
      </div>
    </div>
  );
}
