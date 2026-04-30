"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Sprout } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import KpiCards from "@/components/dashboard/KpiCards";
import FindingMatrix from "@/components/dashboard/FindingMatrix";
import CommodityAnalytics from "@/components/dashboard/CommodityAnalytics";
import SubCategoryAnalytics from "@/components/dashboard/SubCategoryAnalytics";
import DailySummaryCalendar from "@/components/dashboard/DailySummaryCalendar";
import BarangayLeaderboard from "@/components/dashboard/BarangayLeaderboard";

/**
 * Standalone print-friendly route.
 *
 * Reads the same filters the Overview tab uses (barangay, dateFrom, dateTo)
 * from the URL, then re-renders the existing dashboard components in a
 * flowing A4-friendly layout with no sidebar / nav / filter chrome.
 *
 * The user clicks the floating "Print" button (or hits Ctrl+P) to invoke
 * the browser print dialog. We don't auto-print — too jarring.
 */
function PrintReportInner() {
  const params = useSearchParams();
  const { isAdminOrAbove } = useAuth();

  const barangay = params.get("barangay") || "All";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const generatedAt = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
    timeStyle: "short",
  });

  const dateRangeLabel = (() => {
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Up to ${to}`;
    return "All time";
  })();

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {/* Floating print button — hidden when actually printing */}
      <button
        type="button"
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-2xl transition hover:bg-emerald-700 print:hidden"
        aria-label="Print this report"
      >
        <Printer size={16} /> Print
      </button>

      <div className="mx-auto max-w-[1100px] px-8 py-10 print:px-6 print:py-4">
        {/* Header */}
        <header className="mb-8 border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-[0.3em]">
                <Sprout size={12} /> Tubo Municipal Agriculture Office
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                Tubo Agricultural Report
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Period: {dateRangeLabel} · Barangay: {barangay === "All" ? "All barangays" : barangay}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generated</p>
              <p className="text-xs font-bold text-slate-700">{generatedAt}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                AgriDash
              </p>
            </div>
          </div>
        </header>

        {/* Sections */}
        <section className="mb-10 print:break-after-page">
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            1 · Key Performance
          </h2>
          <KpiCards barangayFilter={barangay} dateFrom={from} dateTo={to} />
        </section>

        <section className="mb-10 print:break-after-page">
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            2 · Finding Matrix
          </h2>
          <FindingMatrix barangayFilter={barangay} dateFrom={from} dateTo={to} />
        </section>

        <section className="mb-10 print:break-after-page">
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            3 · Commodity Analytics
          </h2>
          <div className="space-y-6">
            <CommodityAnalytics barangayFilter={barangay} dateFrom={from} dateTo={to} />
            <SubCategoryAnalytics barangayFilter={barangay} dateFrom={from} dateTo={to} />
          </div>
        </section>

        <section className="mb-10 print:break-after-page">
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            4 · Daily Activity
          </h2>
          <DailySummaryCalendar barangayFilter={barangay} dateFrom={from} dateTo={to} />
        </section>

        {isAdminOrAbove && (
          <section className="mb-10">
            <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              5 · Barangay Rankings
            </h2>
            <BarangayLeaderboard barangayFilter={barangay} dateFrom={from} dateTo={to} />
          </section>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-[10px] font-medium text-slate-400">
          Generated by AgriDash · LGU Tubo, Abra · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
          Preparing report…
        </div>
      }
    >
      <PrintReportInner />
    </Suspense>
  );
}
