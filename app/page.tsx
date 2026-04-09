"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import LoginPage from "@/components/LoginPage";
import KpiCards from "@/components/dashboard/KpiCards";
import CommodityAnalytics from "@/components/dashboard/CommodityAnalytics";
import SubCategoryAnalytics from "@/components/dashboard/SubCategoryAnalytics";
import FindingMatrix from "@/components/dashboard/FindingMatrix";
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
import {
  Sprout, BarChart2, AlertTriangle, Users, Table2, Menu, X, ClipboardList,
  LogOut, Key, UserCog, MapPin, TrendingUp,
} from "lucide-react";

const TAB_DESCRIPTIONS: Record<string, string> = {
  overview: "Yield & climate summary",
  damage: "Weather alerts & loss data",
  farmers: "Municipal database",
  records: "Production logs",
  manage: "System configuration",
  users: "Admin roles",
};

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

  if (!isLoggedIn) return <LoginPage />;

  const tabs = ALL_TABS.filter((t) => {
    if (t.superAdminOnly && !isSuperAdmin) return false;
    if (t.adminOnly && !isAdminOrAbove) return false;
    return true;
  });

  const roleBadge = user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role === "ADMIN" ? "Admin" : user?.barangay || "User";
  const initials = (user?.displayName || "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ── Collapsible Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed left-0 top-0 z-40 flex h-full flex-col
          bg-white/80 backdrop-blur-2xl border-r border-slate-200
          p-6 overflow-hidden transition-all duration-500 ease-in-out
          group/sidebar
          lg:w-24 lg:hover:w-80 lg:translate-x-0
          w-80 ${menuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200 shrink-0 transform lg:group-hover/sidebar:rotate-12 transition-all duration-500">
            <Sprout className="text-white w-7 h-7" />
          </div>
          <div className="lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-500 whitespace-nowrap">
            <h1 className="font-black text-2xl tracking-tighter text-slate-950 leading-none">AgriData</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-black mt-1">Municipality of Tubo</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-3">
          {tabs.map((t) => (
            <div key={t.id} className="relative group/item flex items-center">
              <button
                onClick={() => { setTab(t.id); setMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-[1.5rem] transition-all duration-300 font-bold ${
                  tab === t.id
                    ? "bg-slate-950 text-white shadow-2xl shadow-slate-300"
                    : "text-slate-400 hover:bg-white hover:text-slate-950 hover:shadow-lg"
                }`}
              >
                <t.icon className={`w-6 h-6 shrink-0 ${tab === t.id ? "text-emerald-400" : "group-hover/item:text-emerald-500 transition-colors"}`} />
                <span className="lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                  {t.label}
                </span>
              </button>

              {/* Floating tooltip when collapsed */}
              <div className="absolute left-full ml-6 opacity-0 translate-x-4 pointer-events-none group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300 z-[60] hidden lg:block lg:group-hover/sidebar:hidden">
                <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl w-56 border border-white/10 backdrop-blur-xl">
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">{t.label}</p>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">{TAB_DESCRIPTIONS[t.id] || ""}</p>
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Live Status</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="mt-auto">
          {/* Change Password / Logout visible on hover */}
          <div className="lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300 space-y-2 mb-3">
            <button
              onClick={() => setPwDialogOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-slate-100 px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-slate-700 hover:shadow-md"
            >
              <Key size={14} /> Change Password
            </button>
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-slate-100 px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-100"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>

          <div className="flex items-center gap-4 px-2 py-4 rounded-3xl lg:group-hover/sidebar:bg-slate-50 transition-colors duration-300">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center font-black text-slate-600 shrink-0 text-sm">
              {initials}
            </div>
            <div className="flex-1 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300 overflow-hidden text-left">
              <p className="font-black text-sm truncate text-slate-900 tracking-tight">{user?.displayName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{roleBadge}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="lg:pl-24 transition-all duration-500">
        {/* Hero Header */}
        <header className="px-10 pt-10 pb-6">
          <div className="flex justify-between items-end">
            <div>
              {/* Mobile menu button */}
              <button
                className="rounded-2xl border border-slate-200 p-2.5 mb-4 lg:hidden bg-white/70 backdrop-blur"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-[0.3em] mb-2">
                <TrendingUp className="w-4 h-4" />
                {isBarangayUser ? `${user?.barangay} Portal` : "Tubo Municipal Portal"}
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-slate-950 tracking-tighter">
                {tabs.find((t) => t.id === tab)?.label || "Overview"}
              </h2>
              <p className="text-slate-500 font-bold mt-1">{today} {isAdminOrAbove && <ExportButton />}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-10 pb-20 space-y-8 max-w-screen-2xl">
          {tab === "overview" && (
            <>
              {isAdminOrAbove && (
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-emerald-600" />
                  <select
                    className="h-10 appearance-none rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur pl-4 pr-8 text-xs font-black text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition shadow-sm"
                    value={overviewBarangay}
                    onChange={(e) => setOverviewBarangay(e.target.value)}
                  >
                    <option value="All">All Barangays</option>
                    {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {overviewBarangay !== "All" && (
                    <button
                      onClick={() => setOverviewBarangay("All")}
                      className="rounded-[1.5rem] bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-200 transition uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <KpiCards barangayFilter={overviewBarangay} />
              <FindingMatrix barangayFilter={overviewBarangay} />
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

      <PasswordChangeDialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} />
    </div>
  );
}
