"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import LoginPage from "@/components/LoginPage";
import KpiCards from "@/components/dashboard/KpiCards";
import CommodityAnalytics from "@/components/dashboard/CommodityAnalytics";
import SubCategoryAnalytics from "@/components/dashboard/SubCategoryAnalytics";
import DamageRiskMonitoring from "@/components/dashboard/DamageRiskMonitoring";
import FarmerDistribution from "@/components/dashboard/FarmerDistribution";
import DataTable from "@/components/dashboard/DataTable";
import ManagementView from "@/components/dashboard/ManagementView";
import DailySummaryCalendar from "@/components/dashboard/DailySummaryCalendar";
import BarangayLeaderboard from "@/components/dashboard/BarangayLeaderboard";
import ExportButton from "@/components/dashboard/ExportButton";
import PasswordChangeDialog from "@/components/dashboard/PasswordChangeDialog";
import UserManagement from "@/components/dashboard/UserManagement";
import { BARANGAYS } from "@/lib/data";
import { Leaf, BarChart2, AlertTriangle, Users, Table2, Menu, X, ClipboardList, LogOut, Shield, Key, UserCog, MapPin } from "lucide-react";

const ALL_TABS = [
  { id: "overview",  label: "Overview",      icon: BarChart2,      adminOnly: false, superAdminOnly: false },
  { id: "damage",    label: "Damage & Risk", icon: AlertTriangle,  adminOnly: false, superAdminOnly: false },
  { id: "farmers",   label: "Farmers",       icon: Users,          adminOnly: false, superAdminOnly: false },
  { id: "records",   label: "Records",       icon: Table2,         adminOnly: false, superAdminOnly: false },
  { id: "manage",    label: "Management",    icon: ClipboardList,  adminOnly: true,  superAdminOnly: false },
  { id: "users",     label: "Users",         icon: UserCog,        adminOnly: false, superAdminOnly: true },
];

export default function Page() {
  const { isLoggedIn, user, logout, isAdminOrAbove, isBarangayUser, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [overviewBarangay, setOverviewBarangay] = useState("All");

  // Not logged in → show login page
  if (!isLoggedIn) return <LoginPage />;

  // Filter tabs by role
  const tabs = ALL_TABS.filter((t) => {
    if (t.superAdminOnly && !isSuperAdmin) return false;
    if (t.adminOnly && !isAdminOrAbove) return false;
    return true;
  });

  // Role badge
  const roleBadge = user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role === "ADMIN" ? "Admin" : user?.barangay || "User";
  const roleColor = user?.role === "SUPER_ADMIN" ? "#dc2626" : user?.role === "ADMIN" ? "#9333ea" : "#16a34a";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r bg-white/90 backdrop-blur-md shadow-sm transition-transform duration-300 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ borderColor: "var(--border)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b px-5 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--accent-blue)" }}>
            <Leaf size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800" style={{ fontFamily: "Space Mono" }}>Raze AgroDash</p>
            <p className="text-xs text-gray-400">Municipal Agriculture</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={
                tab === t.id
                  ? { background: "color-mix(in oklab, var(--accent-blue) 10%, transparent)", color: "var(--accent-blue)", fontWeight: 600 }
                  : { color: "#6b7280" }
              }
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: roleColor + "18" }}>
              <Shield size={13} style={{ color: roleColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{user?.displayName}</p>
              <p className="text-[10px] font-semibold rounded-full inline-block px-1.5 py-0.5" style={{ background: roleColor + "18", color: roleColor }}>
                {roleBadge}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPwDialogOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-gray-500 transition mb-1.5"
            style={{ borderColor: "var(--border)" }}
          >
            <Key size={13} /> Change Password
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-gray-500 transition hover:text-red-500"
            style={{ borderColor: "var(--border)" }}
          >
            <LogOut size={13} /> Sign Out
          </button>
          <p className="mt-2 text-xs text-gray-300 text-center">Tubo, Abra · Region CAR</p>
        </div>
      </aside>

      {/* Mobile menu backdrop */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/75 px-5 py-3 backdrop-blur-md" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border p-1.5 lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ borderColor: "var(--border)" }}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-800">
                {tabs.find((t) => t.id === tab)?.label || "Overview"}
              </h1>
              <p className="text-xs text-gray-400">
                {isBarangayUser ? `${user?.barangay} Portal` : "Production Monitoring System"}
              </p>
            </div>
          </div>

          {/* Tab pills + Export */}
          <div className="hidden lg:flex items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={
                  tab === t.id
                    ? { background: "var(--accent-blue)", color: "#fff" }
                    : { background: "color-mix(in oklab, var(--surface) 70%, var(--surface-2))", color: "#6b7280", border: "1px solid var(--border)" }
                }
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
            {isAdminOrAbove && (
              <>
                <div className="ml-1 h-5 w-px bg-gray-200" />
                <ExportButton />
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="p-5 space-y-5 max-w-screen-2xl">
          {tab === "overview" && (
            <>
              {isAdminOrAbove && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-green-600" />
                  <select
                    className="h-8 appearance-none rounded-full border border-gray-200 bg-white pl-3 pr-6 text-xs font-semibold text-gray-700 outline-none focus:border-green-400 transition shadow-sm"
                    value={overviewBarangay}
                    onChange={(e) => setOverviewBarangay(e.target.value)}
                  >
                    <option value="All">All Barangays</option>
                    {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {overviewBarangay !== "All" && (
                    <button
                      onClick={() => setOverviewBarangay("All")}
                      className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-200 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <KpiCards barangayFilter={overviewBarangay} />
              <DailySummaryCalendar barangayFilter={overviewBarangay} />
              {isAdminOrAbove && <BarangayLeaderboard barangayFilter={overviewBarangay} />}
              <CommodityAnalytics barangayFilter={overviewBarangay} />
              <SubCategoryAnalytics barangayFilter={overviewBarangay} />
            </>
          )}
          {tab === "damage" && <DamageRiskMonitoring />}
          {tab === "farmers" && <FarmerDistribution />}
          {tab === "records" && <DataTable />}
          {tab === "manage" && isAdminOrAbove && <ManagementView />}
          {tab === "users" && isSuperAdmin && <UserManagement />}
        </main>
      </div>

      {/* Password Change Dialog */}
      <PasswordChangeDialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} />
    </div>
  );
}
