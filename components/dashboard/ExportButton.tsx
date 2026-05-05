"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Download, FileText, Table2, CalendarDays, MapPin, Printer, FileBarChart } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { MONTH_NAMES, formatHouseholdSubsidySummary, productionOutputForRecord } from "@/lib/data";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="px-3 pt-2 pb-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{text}</span>
    </div>
  );
}
import { openPrintableReport } from "@/lib/print-report";

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function ExportButton() {
  const { records, farmers, getHousehold, organizations, getOrganizationIdsForFarmer, getSubsidiesForHousehold } =
    useAgriData();
  const [open, setOpen] = useState(false);
  const dropdown = useAnimatedMount(open, 200);
  const [exportMonth, setExportMonth] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  // Available months from records, sorted newest first
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    records.forEach((r) => { seen.add(r.created_at.slice(0, 7)); });
    return Array.from(seen).sort((a, b) => b.localeCompare(a)).map((key) => {
      const [y, m] = key.split("-");
      return { key, label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}` };
    });
  }, [records]);

  // Filtered records based on selected month
  const filteredRecords = useMemo(
    () => exportMonth === "all" ? records : records.filter((r) => r.created_at.startsWith(exportMonth)),
    [records, exportMonth]
  );

  // Build refDate for print reports
  const exportRefDate = useMemo(() => {
    if (exportMonth === "all") return new Date();
    const [y, m] = exportMonth.split("-").map(Number);
    return new Date(y, m - 1, 15);
  }, [exportMonth]);

  const fileSuffix = exportMonth === "all" ? "" : `-${exportMonth}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── CSV Exports ────────────────────────────────────────────────────────
  function exportRecordsCSV() {
    const headers = ["Barangay", "Commodity", "Sub-category", "Male", "Female", "Total", "Planting Area (ha)", "Harvest (bags/units)", "Damage Pests (ha)", "Damage Calamity (ha)", "Stocking", "Fishery Harvest", "Pests/Diseases", "CalamitySubCategory", "CalamityEvent", "Remarks", "Created"];
    const rows = filteredRecords.map((r) => [
      r.barangay, r.commodity, r.sub_category,
      r.farmer_male, r.farmer_female, r.total_farmers,
      r.planting_area_hectares, productionOutputForRecord(r),
      r.damage_pests_hectares, r.damage_calamity_hectares,
      r.stocking, r.harvesting_fishery,
      `"${r.pests_diseases}"`, r.calamity_sub_category, `"${r.calamity}"`, `"${r.remarks}"`,
      r.created_at.slice(0, 10),
    ].join(","));
    downloadBlob([headers.join(","), ...rows].join("\n"), `agridash-records${fileSuffix}.csv`, "text/csv");
    setOpen(false);
  }

  function exportFarmersCSV() {
    const headers = [
      "Name", "Gender", "Barangay", "RSBSA", "BirthDate", "CivilStatus",
      "HouseholdId", "HouseholdName", "HouseholdHead", "SubsidySummary", "Organizations", "PhotoURL", "Registered",
    ];
    const rows = farmers.map((f) => {
      const hh = f.household_id ? getHousehold(f.household_id) : null;
      const subsidySummary = hh ? formatHouseholdSubsidySummary(getSubsidiesForHousehold(hh.id)) : "";
      const orgNames = getOrganizationIdsForFarmer(f.id)
        .map((oid) => organizations.find((o) => o.id === oid)?.name)
        .filter(Boolean)
        .join("; ");
      return [
        `"${f.name.replace(/"/g, '""')}"`,
        f.gender,
        f.barangay,
        f.rsbsa_number || "",
        f.birth_date || "",
        f.civil_status || "",
        f.household_id || "",
        hh ? `"${(hh.display_name || "").replace(/"/g, '""')}"` : "",
        f.is_household_head ? "yes" : "no",
        `"${subsidySummary.replace(/"/g, '""')}"`,
        `"${orgNames.replace(/"/g, '""')}"`,
        f.photo_url || "",
        f.created_at.slice(0, 10),
      ].join(",");
    });
    downloadBlob([headers.join(","), ...rows].join("\n"), "agridash-farmers.csv", "text/csv");
    setOpen(false);
  }

  function exportMonthlySummaryCSV() {
    const grouped = groupBy(filteredRecords, (r) => `${r.created_at.slice(0, 7)}|${r.barangay}`);
    const headers = ["Month", "Barangay", "Records", "Farmers", "Harvest (bags)", "Area (ha)", "Damage (ha)"];
    const rows = Object.entries(grouped).map(([key, group]) => {
      const [month, barangay] = key.split("|");
      return [month, barangay, group.length,
        group.reduce((s, r) => s + r.total_farmers, 0),
        group.reduce((s, r) => s + productionOutputForRecord(r), 0),
        group.reduce((s, r) => s + r.planting_area_hectares, 0).toFixed(2),
        group.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0).toFixed(2),
      ].join(",");
    });
    downloadBlob([headers.join(","), ...rows].join("\n"), `agridash-monthly-summary${fileSuffix}.csv`, "text/csv");
    setOpen(false);
  }

  function exportBarangaySummaryCSV() {
    const grouped = groupBy(filteredRecords, (r) => r.barangay);
    const headers = ["Barangay", "Records", "Male", "Female", "Total", "Harvest (bags)", "MT", "Area (ha)", "Damage (ha)", "Damage %", "Last Updated"];
    const rows = Object.entries(grouped).map(([barangay, group]) => {
      const male = group.reduce((s, r) => s + r.farmer_male, 0);
      const female = group.reduce((s, r) => s + r.farmer_female, 0);
      const harvest = group.reduce((s, r) => s + productionOutputForRecord(r), 0);
      const area = group.reduce((s, r) => s + r.planting_area_hectares, 0);
      const dmg = group.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
      const lastUpdated = group.reduce((latest, r) => r.created_at > latest ? r.created_at : latest, group[0].created_at).slice(0, 10);
      return [barangay, group.length, male, female, male + female, harvest, (harvest * 0.04).toFixed(2), area.toFixed(2), dmg.toFixed(2), area > 0 ? ((dmg / area) * 100).toFixed(1) : "0", lastUpdated].join(",");
    });
    downloadBlob([headers.join(","), ...rows].join("\n"), `agridash-barangay-summary${fileSuffix}.csv`, "text/csv");
    setOpen(false);
  }

  // ── Printable Reports ──────────────────────────────────────────────────
  function printReport(period: "monthly" | "quarterly" | "yearly" | "full") {
    openPrintableReport({ records: filteredRecords, farmers }, period, exportRefDate);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-[1.5rem] bg-white/50 backdrop-blur border border-white/40 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-white/70 hover:text-slate-900 transition shadow-sm"
      >
        <Download size={16} /> Export
      </button>

      {dropdown.mounted && (
        <div className={`absolute right-0 top-full mt-1 w-56 rounded-[2rem] bg-white/90 backdrop-blur-xl border border-white/40 py-1 shadow-2xl z-50 dropdown-animate ${dropdown.visible ? "dropdown-animate-visible" : ""}`}>
          {/* Month picker */}
          <div className="px-3 py-2 border-b border-white/40">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Period</label>
            <select
              className="mt-1 w-full appearance-none rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
            >
              <option value="all">All Time</option>
              {availableMonths.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <SectionLabel text="CSV Downloads" />
          <button onClick={exportRecordsCSV} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <Table2 size={14} className="text-green-600" /> Records CSV
          </button>
          <button onClick={exportFarmersCSV} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <FileText size={14} className="text-blue-600" /> Farmers CSV
          </button>
          <button onClick={exportMonthlySummaryCSV} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <CalendarDays size={14} className="text-orange-600" /> Monthly Summary CSV
          </button>
          <button onClick={exportBarangaySummaryCSV} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <MapPin size={14} className="text-red-600" /> Barangay Summary CSV
          </button>

          <div className="mx-2 my-1.5 border-t border-white/40" />

          <SectionLabel text="Printable Reports" />
          <button onClick={() => printReport("monthly")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <Printer size={14} className="text-blue-600" /> Monthly Report
          </button>
          <button onClick={() => printReport("quarterly")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <FileBarChart size={14} className="text-purple-600" /> Quarterly Report
          </button>
          <button onClick={() => printReport("yearly")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-600 hover:bg-emerald-50 transition">
            <CalendarDays size={14} className="text-teal-600" /> Yearly Report
          </button>
          <button onClick={() => printReport("full")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-green-700 hover:bg-emerald-50 transition">
            <Printer size={14} className="text-green-600" /> Full Summary Report
          </button>
        </div>
      )}
    </div>
  );
}
