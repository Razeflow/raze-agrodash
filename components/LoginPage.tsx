"use client";
import { useState, useId } from "react";
import { Sprout, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const PRIMARY = "#15803D";
const SECONDARY = "#86EFAC";

const HERO_IMAGE = "/login-hero.png";

/** Subtle topographic lines for the form panel (no external asset). */
const TOPO_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <g fill="none" stroke="#64748b" stroke-width="0.4" opacity="0.14">
      <path d="M0 48 Q40 28 80 48 T160 48"/>
      <path d="M0 96 Q48 72 96 96 T160 96"/>
      <path d="M0 128 Q56 108 112 128 T160 128"/>
      <path d="M24 0 Q32 80 24 160"/>
      <path d="M80 0 Q88 80 80 160"/>
      <path d="M136 0 Q144 80 136 160"/>
      <path d="M0 24 Q80 8 160 24"/>
      <path d="M0 72 Q80 56 160 72"/>
    </g>
  </svg>`
)}")`;

/** Two-band S-curve: dark forest against photo, bright green toward form. */
function Swoop({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const gidBack = `swoopBack-${uid}`;
  const gidFront = `swoopFront-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 200 1000"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gidBack} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14532d" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
        <linearGradient id={gidFront} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <path
        d="M 95 0 C 205 260 205 740 35 1000 L 200 1000 L 200 0 Z"
        fill={`url(#${gidBack})`}
      />
      <path
        d="M 128 0 C 210 280 210 720 68 1000 L 200 1000 L 200 0 Z"
        fill={`url(#${gidFront})`}
      />
    </svg>
  );
}

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
      const result = await login(username.trim(), password);
      if (result !== true) {
        setError(result);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Mobile / tablet: soft gradient strip */}
      <div
        className="relative flex shrink-0 items-center justify-center gap-3 px-6 py-8 lg:hidden"
        style={{
          background: `linear-gradient(135deg, ${SECONDARY} 0%, ${PRIMARY} 55%, #166534 100%)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-md ring-1 ring-white/30">
          <Sprout size={26} className="text-white drop-shadow-sm" strokeWidth={2.2} />
        </div>
        <div className="text-left text-white">
          <h1 className="text-xl font-bold tracking-tight drop-shadow-sm">Raze AgroDash</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
            Municipal Agriculture Production Monitoring
          </p>
        </div>
      </div>

      {/* Left: hero + light wash + glass mission + two-tone swoop (desktop) */}
      <div className="relative hidden min-h-[40vh] w-full overflow-hidden lg:flex lg:min-h-screen lg:w-[50%] lg:max-w-[640px] lg:shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg, rgba(134, 239, 172, 0.22) 0%, rgba(21, 128, 61, 0.38) 45%, rgba(15, 80, 40, 0.35) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-14">
          <div className="pointer-events-none flex justify-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/25 backdrop-blur-md">
              <Sprout size={20} className="text-white/95" strokeWidth={2} />
            </div>
          </div>

          <div className="max-w-lg">
            <div className="rounded-2xl border border-white/25 bg-white/15 p-6 shadow-lg backdrop-blur-xl xl:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95">
                LGU Tubo, Abra · Region CAR
              </p>
              <p className="mt-4 text-2xl font-bold leading-snug tracking-tight text-white drop-shadow-sm xl:text-3xl">
                Supporting farmers and sustainable municipal agriculture.
              </p>
            </div>
          </div>
        </div>

        <Swoop className="pointer-events-none absolute top-0 right-0 z-20 h-full w-[160px] translate-x-[12%] xl:w-[175px]" />
      </div>

      {/* Right: topo texture + leaf watermark + centered form */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-10 sm:px-10 lg:px-12 lg:py-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: TOPO_BG, backgroundSize: "160px 160px" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse 70% 45% at 100% 20%, ${SECONDARY}18 0%, transparent 60%)`,
          }}
        />
        <Sprout
          className="pointer-events-none absolute -right-8 bottom-[8%] h-[min(52vw,420px)] w-[min(52vw,420px)] text-emerald-600/[0.09] lg:right-4"
          strokeWidth={0.75}
          aria-hidden
        />

        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-8 hidden text-center lg:block">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(145deg, ${SECONDARY} 0%, ${PRIMARY} 100%)`,
                boxShadow: `0 12px 28px -6px ${PRIMARY}55, 0 4px 12px -4px rgba(21, 128, 61, 0.25)`,
              }}
            >
              <Sprout size={32} className="text-white" strokeWidth={2.2} />
            </div>
            <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-800 sm:text-3xl">
              Raze AgroDash
            </h1>
            <p
              className="mx-auto mt-2 max-w-sm text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] sm:text-xs"
              style={{ color: PRIMARY }}
            >
              Municipal Agriculture Production Monitoring
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-100/90 bg-white/95 p-8 shadow-[0_24px_60px_-16px_rgba(21,128,61,0.12),0_10px_30px_-12px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-9">
            {loading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl bg-white/80 p-6 backdrop-blur-[2px]"
                aria-busy="true"
                aria-live="polite"
              >
                <div className="w-full max-w-xs space-y-3">
                  <div className="h-2.5 w-3/4 rounded-full skeleton-shimmer" />
                  <div className="h-2.5 w-full rounded-full skeleton-shimmer" />
                  <div className="h-2.5 w-5/6 rounded-full skeleton-shimmer" />
                </div>
                <p className="text-xs font-bold text-slate-500">Loading your workspace…</p>
              </div>
            )}
            <h2 className="text-lg font-bold text-slate-800">Sign in</h2>
            <p className="mb-6 mt-1 text-xs text-slate-500">
              Enter your credentials to access the dashboard.
            </p>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50/90 px-3.5 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: PRIMARY }}
                >
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#15803D] focus:ring-[3px] focus:ring-[#86EFAC]/90 focus:shadow-[0_4px_16px_-4px_rgba(21,128,61,0.35)]"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: PRIMARY }}
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#15803D] focus:ring-[3px] focus:ring-[#86EFAC]/90 focus:shadow-[0_4px_16px_-4px_rgba(21,128,61,0.35)]"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  backgroundColor: PRIMARY,
                  boxShadow: `0 6px 18px -4px ${PRIMARY}77`,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = `0 10px 32px -6px ${PRIMARY}aa, 0 0 28px -8px ${SECONDARY}`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 6px 18px -4px ${PRIMARY}77`;
                }}
              >
                <LogIn size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-[11px] font-medium text-slate-400">
            Municipal Agriculture Office · Tubo, Abra · Region CAR
          </p>
        </div>
      </div>
    </div>
  );
}
