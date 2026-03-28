"use client";
import { useState, useRef, useEffect } from "react";
import { Download, FileText, Table2, CalendarDays, MapPin, Printer, FileBarChart } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
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
  const { records, farmers } = useAgriData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── CSV Exports ────────────────────────────────────────────────────────
  function exportRecordsCSV() {
    const headers = ["Barangay", "Commodity", "Sub-category", "Male", "Female", "Total", "Planting Area (ha)", "Harvest (bags)", "Damage Pests (ha)", "Damage Calamity (ha)", "Pests/Diseases", "Calamity", "Remarks", "Created"];
    const rows = records.map((r) => [
      r.barangay, r.commodity, r.sub_category,
      r.farmer_male, r.farmer_female, r.total_farmers,
      r.planting_area_hectares, r.harvesting_output_bags,
      r.damage_pests_hectares, r.damage_calamity_hectares,
      `"${r.pests_diseases}"`, `"${r.calamity}"`, `"${r.remarks}"`,
      r.created_at.slice(0, 10),
    ].join(","));
    downloadBlob([headers.join(","), ...rows].join("\n"), "agridash-records.csv", "text/csv");
    setOpen(false);
  }

  function exportFarmersCSV() {
    const headers = ["Name", "Gender", "Barangay", "Registered"];
    const rows = farmers.map((f) => [
      `"${f.name}"`, f.gender, f.barangay, f.created_at.slice(0, 10),
    ].join(","));
    downloadBlob([headers.join(","), ...rows].join("\n"), "agridash-farmers.csv", "text/csv");
    setOpen(false);
  }

  function exportMonthlySummaryCSV() {
    const grouped = groupBy(records, (r) => `${r.created_at.slice(0, 7)}|${r.barangay}`);
    const headers = ["Month", "Barangay", "Records", "Farmers", "Harvest (bags)", "Area (ha)", "Damage (ha)"];
    const rows = Object.entries(grouped).map(([key, group]) => {
      const [month, barangay] = key.split("|");
      return [month, barangay, group.length,
        group.reduce((s, r) => s + r.total_farmers, 0),
        group.reduce((s, r) => s + r.harvesting_output_bags, 0),
        group.reduce((s, r) => s + r.planting_area_hectares, 0).toFixed(2),
        group.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0).toFixed(2),
      ].join(",");
    });
    downloadBlob([headers.join(","), ...rows].join("\n"), "agridash-monthly-summary.csv", "text/csv");
    setOpen(false);
  }

  function exportBarangaySummaryCSV() {
    const grouped = groupBy(records, (r) => r.barangay);
    const headers = ["Barangay", "Records", "Male", "Female", "Total", "Harvest (bags)", "MT", "Area (ha)", "Damage (ha)", "Damage %", "Last Updated"];
    const rows = Object.entries(grouped).map(([barangay, group]) => {
      const male = group.reduce((s, r) => s + r.farmer_male, 0);
      const female = group.reduce((s, r) => s + r.farmer_female, 0);
      const harvest = group.reduce((s, r) => s + r.harvesting_output_bags, 0);
      const area = group.reduce((s, r) => s + r.planting_area_hectares, 0);
      const dmg = group.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
      const lastUpdated = group.reduce((latest, r) => r.created_at > latest ? r.created_at : latest, group[0].created_at).slice(0, 10);
      return [barangay, group.length, male, female, male + female, harvest, (harvest * 0.04).toFixed(2), area.toFixed(2), dmg.toFixed(2), area > 0 ? ((dmg / area) * 100).toFixed(1) : "0", lastUpdated].join(",");
    });
    downloadBlob([headers.join(","), ...rows].join("\n"), "agridash-barangay-summary.csv", "text/csv");
    setOpen(false);
  }

  // ── Printable Reports ──────────────────────────────────────────────────
  function printReport(period: "monthly" | "quarterly" | "yearly" | "full") {
    openPrintableReport({ records, farmers }, period);
    setOpen(false);
  }

  // ── Section Label ──────────────────────────────────────────────────────
  const SectionLabel = ({ text }: { text: string }) => (
    <div className="px-3 pt-2 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{text}</span>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
      >
        <Download size={13} /> Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-lg z-50">
          <SectionLabel text="CSV Downloads" />
          <button onClick={exportRecordsCSV} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-green-50 transition">
            <Table2 size={14} className="text-green-600" /> Records CSV
          </button>
          <button onClick={exportFarmersCSV} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-green-50 transition">
            <FileText size={14} className="text-blue-600" /> Farmers CSV
          </button>
          <button onClick={exportMonthlySummaryCSV} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-green-50 transition">
            <CalendarDays size={14} className="text-orange-600" /> Monthly Summary CSV
          </button>
          <button onClick={exportBarangaySummaryCSV} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-green-50 transition">
            <MapPin size={14} className="text-red-600" /> Barangay Summary CSV
          </button>

          <div className="mx-2 my-1.5 border-t border-gray-100" />

          <SectionLabel text="Printable Reports" />
          <button onClick={() => printReport("monthly")} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-blue-50 transition">
            <Printer size={14} className="text-blue-600" /> 📅 Monthly Report
          </button>
          <button onClick={() => printReport("quarterly")} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-purple-50 transition">
            <FileBarChart size={14} className="text-purple-600" /> 📊 Quarterly Report
          </button>
          <button onClick={() => printReport("yearly")} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-teal-50 transition">
            <CalendarDays size={14} className="text-teal-600" /> 📆 Yearly Report
          </button>
          <button onClick={() => printReport("full")} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 transition">
            <Printer size={14} className="text-green-600" /> 🖨️ Full Summary Report
          </button>
        </div>
      )}
    </div>
  );
}
