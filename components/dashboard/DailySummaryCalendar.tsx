"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus, UserPlus, Wheat, MapPin, AlertTriangle } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { COMMODITY_COLORS, BARANGAYS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import RecordFormDialog from "./RecordFormDialog";
import FarmerFormDialog from "./FarmerFormDialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(sunday);
    wd.setDate(sunday.getDate() + i);
    week.push(wd);
  }
  return week;
}

function groupByBarangay(records: AgriRecord[]) {
  const map: Record<string, AgriRecord[]> = {};
  records.forEach((r) => {
    if (!map[r.barangay]) map[r.barangay] = [];
    map[r.barangay].push(r);
  });
  return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DailySummaryCalendar() {
  const { recordsByDate } = useAgriData();
  const { isBarangayUser, userBarangay, isAdminOrAbove } = useAuth();

  const today = new Date();
  const todayStr = formatDateKey(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [view, setView] = useState<"monthly" | "weekly" | "daily">("monthly");

  // Quick-add state
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);
  const [quickAddBarangay, setQuickAddBarangay] = useState<string>("");

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const weekDays = useMemo(() => getWeekDays(selectedDay), [selectedDay]);

  function dateKey(day: number) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function prevWeek() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() - 7);
    setSelectedDay(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextWeek() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + 7);
    setSelectedDay(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function handleDayClick(day: number) {
    const d = new Date(year, month, day);
    setSelectedDay(d);
  }

  function handleWeekDayClick(d: Date) {
    setSelectedDay(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function prevDay() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() - 1);
    setSelectedDay(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextDay() {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + 1);
    setSelectedDay(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const selectedDayStr = formatDateKey(selectedDay);
  const selectedRecords = recordsByDate[selectedDayStr] || [];
  const grouped = useMemo(() => groupByBarangay(selectedRecords), [selectedRecords]);

  const defaultBarangay = isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0];

  function openRecordForm(barangay?: string) {
    setQuickAddBarangay(barangay || defaultBarangay);
    setRecordFormOpen(true);
  }

  function openFarmerForm(barangay?: string) {
    setQuickAddBarangay(barangay || defaultBarangay);
    setFarmerFormOpen(true);
  }

  // Format the selected day for display
  const selectedDayFormatted = `${MONTHS[selectedDay.getMonth()]} ${selectedDay.getDate()}, ${selectedDay.getFullYear()}`;
  const selectedDayOfWeek = DAYS[selectedDay.getDay()];

  return (
    <>
      <div className="fade-up delay-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* ── LEFT: Calendar Panel ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-green-600" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                Daily Summary
              </h2>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
              <button
                onClick={() => setView("monthly")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 ${
                  view === "monthly"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setView("weekly")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 ${
                  view === "weekly"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setView("daily")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 ${
                  view === "daily"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Daily
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={view === "monthly" ? prevMonth : view === "weekly" ? prevWeek : prevDay}
              className="rounded-lg p-1.5 hover:bg-gray-100 transition"
            >
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-gray-700">
              {view === "monthly"
                ? `${MONTHS[month]} ${year}`
                : view === "weekly"
                ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
                : `${selectedDayOfWeek}, ${selectedDayFormatted}`}
            </span>
            <button
              onClick={view === "monthly" ? nextMonth : view === "weekly" ? nextWeek : nextDay}
              className="rounded-lg p-1.5 hover:bg-gray-100 transition"
            >
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          {/* ── Monthly View ──────────────────────────────────────────── */}
          {view === "monthly" && (
            <div className="transition-all duration-300">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const key = dateKey(day);
                  const recs = recordsByDate[key] || [];
                  const isToday = key === todayStr;
                  const isSelected = isSameDay(selectedDay, new Date(year, month, day));

                  // Get unique commodity colors for dots
                  const commodityColors = [...new Set(recs.map((r) => COMMODITY_COLORS[r.commodity] || "#888"))];

                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`relative flex flex-col items-start rounded-lg border min-h-[80px] p-2 text-xs transition-all duration-300 ${
                        isSelected
                          ? "bg-green-600 text-white border-green-600 shadow-md"
                          : isToday
                          ? "bg-green-50 text-green-700 ring-2 ring-green-400 border-green-200"
                          : "border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      <span className={`font-semibold ${isSelected ? "text-white" : ""}`}>{day}</span>

                      {/* Commodity color dots */}
                      {commodityColors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {commodityColors.slice(0, 5).map((color, ci) => (
                            <span
                              key={ci}
                              className="block h-1.5 w-1.5 rounded-full"
                              style={{
                                background: isSelected ? "rgba(255,255,255,0.8)" : color,
                              }}
                            />
                          ))}
                          {commodityColors.length > 5 && (
                            <span className={`text-[9px] leading-none ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                              +{commodityColors.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Record count badge */}
                      {recs.length > 0 && (
                        <span
                          className={`mt-auto self-end rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {recs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Weekly View ───────────────────────────────────────────── */}
          {view === "weekly" && (
            <div className="transition-all duration-300">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((wd) => {
                  const wdStr = formatDateKey(wd);
                  const recs = recordsByDate[wdStr] || [];
                  const isToday = wdStr === todayStr;
                  const isSelected = isSameDay(selectedDay, wd);

                  return (
                    <div key={wdStr} className="flex flex-col gap-1">
                      {/* Day header */}
                      <button
                        onClick={() => handleWeekDayClick(wd)}
                        className={`rounded-lg px-2 py-2 text-center transition-all duration-300 ${
                          isSelected
                            ? "bg-green-600 text-white shadow-md"
                            : isToday
                            ? "bg-green-50 text-green-700 ring-2 ring-green-400"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase">{DAYS[wd.getDay()]}</div>
                        <div className="text-lg font-bold">{wd.getDate()}</div>
                      </button>

                      {/* Record cards */}
                      <div className="flex flex-col gap-1 min-h-[100px]">
                        {recs.length === 0 ? (
                          <div className="flex-1 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center p-2">
                            <span className="text-[10px] text-gray-300 text-center">No records</span>
                          </div>
                        ) : (
                          recs.slice(0, 4).map((r) => (
                            <div
                              key={r.id}
                              className="rounded-lg border border-gray-100 bg-white p-1.5 shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer"
                              onClick={() => handleWeekDayClick(wd)}
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className="block h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }}
                                />
                                <span className="text-[10px] font-medium text-gray-700 truncate">
                                  {r.sub_category}
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-400 mt-0.5 pl-3">
                                {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                              </div>
                            </div>
                          ))
                        )}
                        {recs.length > 4 && (
                          <div className="text-center text-[10px] text-gray-400 font-medium">
                            +{recs.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Daily View ────────────────────────────────────────────── */}
          {view === "daily" && (
            <div className="transition-all duration-300">
              {/* Daily stats bar */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-green-100 bg-green-50/50 p-3 text-center">
                  <p className="text-xs text-gray-500">Records</p>
                  <p className="text-2xl font-bold text-green-700">{selectedRecords.length}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center">
                  <p className="text-xs text-gray-500">Farmers</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {selectedRecords.reduce((s, r) => s + r.total_farmers, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                  <p className="text-xs text-gray-500">Harvest</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {selectedRecords.reduce((s, r) => s + r.harvesting_output_bags, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400">bags</p>
                </div>
              </div>

              {selectedRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 rounded-full bg-gray-50 p-4">
                    <Calendar size={28} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">No records for this day</p>
                  <p className="text-xs text-gray-300 mt-1">Use the arrows to navigate to a day with data</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {grouped.map(([barangay, recs]) => {
                    const totalBags = recs.reduce((s, r) => s + r.harvesting_output_bags, 0);
                    const totalArea = recs.reduce((s, r) => s + r.planting_area_hectares, 0);
                    const totalDmg = recs.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
                    const commodities = [...new Set(recs.map((r) => r.commodity))];

                    return (
                      <div key={barangay} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white px-4 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-green-600" />
                            <p className="text-sm font-bold text-gray-700">{barangay}</p>
                          </div>
                          <div className="flex gap-3 text-[11px] text-gray-400">
                            <span>{recs.length} entries</span>
                            {totalBags > 0 && <span className="font-semibold text-green-600">{totalBags.toLocaleString()} bags</span>}
                            {totalArea > 0 && <span>{totalArea.toFixed(1)} ha</span>}
                            {totalDmg > 0 && <span className="text-red-500">{totalDmg.toFixed(1)} ha dmg</span>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
                          {commodities.map((c) => (
                            <span
                              key={c}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: (COMMODITY_COLORS[c] || "#888") + "18", color: COMMODITY_COLORS[c] || "#888" }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>

                        {/* Record detail rows */}
                        <div className="divide-y divide-gray-50 px-4 pb-2 mt-2">
                          {recs.map((r) => {
                            const dmg = r.damage_pests_hectares + r.damage_calamity_hectares;
                            return (
                              <div key={r.id} className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-700 truncate">{r.sub_category}</p>
                                    <p className="text-[11px] text-gray-400">
                                      {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                                      {r.farmer_names ? ` · ${r.farmer_names.split(",").slice(0, 2).join(", ")}${r.farmer_names.split(",").length > 2 ? "..." : ""}` : ""}
                                    </p>
                                    {dmg > 0 && (
                                      <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                                        <AlertTriangle size={10} /> {dmg.toFixed(1)} ha damage
                                        {r.pests_diseases !== "None" && ` · ${r.pests_diseases}`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  {r.harvesting_output_bags > 0 && (
                                    <p className="font-mono text-xs font-semibold text-green-600">{r.harvesting_output_bags.toLocaleString()} bags</p>
                                  )}
                                  {r.planting_area_hectares > 0 && (
                                    <p className="text-[11px] text-gray-400">{r.planting_area_hectares} ha</p>
                                  )}
                                  {r.commodity === "Fishery" && r.harvesting_fishery > 0 && (
                                    <p className="font-mono text-xs font-semibold text-blue-600">{r.harvesting_fishery.toLocaleString()} fish</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Side Summary Panel (hidden in daily view) ────────── */}
        {view !== "daily" && (
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm flex flex-col">
          {/* Panel header */}
          <div className="mb-4 border-b border-gray-100 pb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {selectedDayOfWeek}
            </p>
            <h3 className="text-lg font-bold text-gray-800">{selectedDayFormatted}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedRecords.length} record{selectedRecords.length !== 1 ? "s" : ""} submitted
            </p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
            {selectedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-gray-50 p-4">
                  <Calendar size={24} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 mb-1">No records for this day</p>
                <p className="text-xs text-gray-300">Select a day with records or add a new one</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(([barangay, recs]) => {
                  const totalFarmers = recs.reduce((s, r) => s + r.total_farmers, 0);
                  const totalBags = recs.reduce((s, r) => s + r.harvesting_output_bags, 0);
                  const commodities = [...new Set(recs.map((r) => r.commodity))];

                  return (
                    <div
                      key={barangay}
                      className="rounded-xl border border-gray-100 overflow-hidden transition-all duration-300"
                    >
                      {/* Barangay header */}
                      <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{barangay}</p>
                          <div className="flex gap-2 text-[11px] text-gray-400 mt-0.5">
                            <span>{recs.length} {recs.length === 1 ? "entry" : "entries"}</span>
                            <span>{totalFarmers} farmers</span>
                            {totalBags > 0 && <span>{totalBags.toLocaleString()} bags</span>}
                          </div>
                        </div>
                      </div>

                      {/* Commodity tags */}
                      <div className="flex flex-wrap gap-1 px-3 pt-2">
                        {commodities.map((c) => (
                          <span
                            key={c}
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: (COMMODITY_COLORS[c] || "#888") + "18",
                              color: COMMODITY_COLORS[c] || "#888",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Record rows */}
                      <div className="divide-y divide-gray-50 px-3 pb-2 mt-2">
                        {recs.map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0"
                                style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">
                                  {r.sub_category}
                                </p>
                                <p className="text-[11px] text-gray-400 truncate">
                                  {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                                  {r.farmer_names
                                    ? ` · ${r.farmer_names
                                        .split(",")
                                        .slice(0, 2)
                                        .join(", ")}${
                                        r.farmer_names.split(",").length > 2 ? "..." : ""
                                      }`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              {r.harvesting_output_bags > 0 && (
                                <p className="font-mono text-xs font-semibold text-green-600">
                                  {r.harvesting_output_bags.toLocaleString()} bags
                                </p>
                              )}
                              {r.planting_area_hectares > 0 && (
                                <p className="text-[11px] text-gray-400">{r.planting_area_hectares} ha</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick-add buttons */}
          <div className="mt-4 border-t border-gray-100 pt-3 flex gap-2">
            <button
              onClick={() => openRecordForm()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <Plus size={14} />
              Add Record
            </button>
            <button
              onClick={() => openFarmerForm()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-300"
            >
              <UserPlus size={14} />
              Register Farmer
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Quick-add dialogs */}
      <RecordFormDialog
        open={recordFormOpen}
        onClose={() => setRecordFormOpen(false)}
        mode="add"
        defaultBarangay={quickAddBarangay}
      />
      <FarmerFormDialog
        open={farmerFormOpen}
        onClose={() => setFarmerFormOpen(false)}
        mode="add"
        defaultBarangay={quickAddBarangay}
      />
    </>
  );
}
