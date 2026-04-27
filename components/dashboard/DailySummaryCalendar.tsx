"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus, UserPlus, MapPin, AlertTriangle } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { COMMODITY_COLORS, BARANGAYS } from "@/lib/data";
import type { AgriRecord } from "@/lib/data";
import RecordFormDialog from "./RecordFormDialog";
import FarmerFormDialog from "./FarmerFormDialog";
import BentoCard from "@/components/ui/BentoCard";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatDateKey(d: Date) { return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); }

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
  for (let i = 0; i < 7; i++) { const wd = new Date(sunday); wd.setDate(sunday.getDate() + i); week.push(wd); }
  return week;
}

function groupByBarangay(records: AgriRecord[]) {
  const map: Record<string, AgriRecord[]> = {};
  records.forEach((r) => { if (!map[r.barangay]) map[r.barangay] = []; map[r.barangay].push(r); });
  return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DailySummaryCalendar({ barangayFilter }: { barangayFilter?: string }) {
  const { recordsByDate } = useAgriData();
  const isFiltered = barangayFilter && barangayFilter !== "All";
  const filteredByDate = useMemo(() => {
    if (!isFiltered) return recordsByDate;
    const result: Record<string, AgriRecord[]> = {};
    for (const [date, recs] of Object.entries(recordsByDate)) {
      const filtered = recs.filter((r) => r.barangay === barangayFilter);
      if (filtered.length > 0) result[date] = filtered;
    }
    return result;
  }, [recordsByDate, isFiltered, barangayFilter]);
  const { isBarangayUser, userBarangay } = useAuth();

  const today = new Date();
  const todayStr = formatDateKey(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [view, setView] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);
  const [quickAddBarangay, setQuickAddBarangay] = useState<string>("");

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekDays(selectedDay), [selectedDay]);

  function dateKey(day: number) { return `${year}-${pad(month + 1)}-${pad(day)}`; }
  function prevMonth() { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }
  function prevWeek() { const d = new Date(selectedDay); d.setDate(d.getDate() - 7); setSelectedDay(d); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function nextWeek() { const d = new Date(selectedDay); d.setDate(d.getDate() + 7); setSelectedDay(d); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function prevDay() { const d = new Date(selectedDay); d.setDate(d.getDate() - 1); setSelectedDay(d); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function nextDay() { const d = new Date(selectedDay); d.setDate(d.getDate() + 1); setSelectedDay(d); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function handleDayClick(day: number) { setSelectedDay(new Date(year, month, day)); }
  function handleWeekDayClick(d: Date) { setSelectedDay(d); setYear(d.getFullYear()); setMonth(d.getMonth()); }

  const selectedDayStr = formatDateKey(selectedDay);
  const selectedRecords = useMemo(() => filteredByDate[selectedDayStr] ?? [], [filteredByDate, selectedDayStr]);
  const grouped = useMemo(() => groupByBarangay(selectedRecords), [selectedRecords]);
  const defaultBarangay = isBarangayUser && userBarangay ? userBarangay : BARANGAYS[0];
  function openRecordForm(barangay?: string) { setQuickAddBarangay(barangay || defaultBarangay); setRecordFormOpen(true); }
  function openFarmerForm(barangay?: string) { setQuickAddBarangay(barangay || defaultBarangay); setFarmerFormOpen(true); }

  const selectedDayFormatted = `${MONTHS[selectedDay.getMonth()]} ${selectedDay.getDate()}, ${selectedDay.getFullYear()}`;
  const selectedDayOfWeek = DAYS[selectedDay.getDay()];

  // View toggle element
  const viewToggle = (
    <div className="flex items-center gap-1 rounded-[1.5rem] bg-slate-100/60 p-1">
      {(["monthly", "weekly", "daily"] as const).map((v) => (
        <button
          key={v}
          onClick={(e) => { e.stopPropagation(); setView(v); }}
          className={`rounded-[1rem] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
            view === v
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
              : "text-slate-400 hover:text-slate-700"
          }`}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="fade-up delay-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* ── LEFT: Calendar Panel ──────────────────────────────────────── */}
        <BentoCard
          variant="compact"
          title="Daily Summary"
          subtitle="Record activity calendar"
          icon={Calendar}
          action={viewToggle}
        >
          {/* Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button onClick={view === "monthly" ? prevMonth : view === "weekly" ? prevWeek : prevDay} className="rounded-2xl p-2 hover:bg-white/50 transition">
              <ChevronLeft size={16} className="text-slate-400" />
            </button>
            <span className="min-w-[180px] text-center text-sm font-bold text-slate-700">
              {view === "monthly"
                ? `${MONTHS[month]} ${year}`
                : view === "weekly"
                ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
                : `${selectedDayOfWeek}, ${selectedDayFormatted}`}
            </span>
            <button onClick={view === "monthly" ? nextMonth : view === "weekly" ? nextWeek : nextDay} className="rounded-2xl p-2 hover:bg-white/50 transition">
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>

          {/* Monthly */}
          {view === "monthly" && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const key = dateKey(day);
                  const recs = filteredByDate[key] || [];
                  const isToday = key === todayStr;
                  const isSelected = isSameDay(selectedDay, new Date(year, month, day));
                  const commodityColors = [...new Set(recs.map((r) => COMMODITY_COLORS[r.commodity] || "#888"))];
                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`relative flex flex-col items-start rounded-2xl border min-h-[80px] p-2.5 text-xs transition-all duration-300 ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-200"
                          : isToday
                          ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400 border-emerald-200"
                          : "border-white/40 text-slate-500 hover:bg-white/50 hover:border-slate-200"
                      }`}
                    >
                      <span className={`font-black ${isSelected ? "text-white" : ""}`}>{day}</span>
                      {commodityColors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {commodityColors.slice(0, 5).map((color, ci) => (
                            <span key={ci} className="block h-1.5 w-1.5 rounded-full" style={{ background: isSelected ? "rgba(255,255,255,0.8)" : color }} />
                          ))}
                        </div>
                      )}
                      {recs.length > 0 && (
                        <span className={`mt-auto self-end rounded-[1rem] px-2 py-0.5 text-[10px] font-black ${isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                          {recs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Weekly */}
          {view === "weekly" && (
            <div className="grid grid-cols-7 gap-3">
              {weekDays.map((wd) => {
                const wdStr = formatDateKey(wd);
                const recs = filteredByDate[wdStr] || [];
                const isToday = wdStr === todayStr;
                const isSelected = isSameDay(selectedDay, wd);
                return (
                  <div key={wdStr} className="flex flex-col gap-2">
                    <button
                      onClick={() => handleWeekDayClick(wd)}
                      className={`rounded-2xl px-2 py-2.5 text-center transition-all duration-300 ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-xl shadow-emerald-200"
                          : isToday
                          ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400"
                          : "bg-white/30 text-slate-500 hover:bg-white/50"
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest">{DAYS[wd.getDay()]}</div>
                      <div className="text-lg font-black">{wd.getDate()}</div>
                    </button>
                    <div className="flex flex-col gap-1 min-h-[100px]">
                      {recs.length === 0 ? (
                        <div className="flex-1 rounded-2xl border-2 border-dashed border-slate-200/50 flex items-center justify-center p-2">
                          <span className="text-[10px] text-slate-300 text-center font-bold">No records</span>
                        </div>
                      ) : (
                        recs.slice(0, 4).map((r) => (
                          <div key={r.id} className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-2 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => handleWeekDayClick(wd)}>
                            <div className="flex items-center gap-1">
                              <span className="block h-2 w-2 rounded-full flex-shrink-0" style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }} />
                              <span className="text-[10px] font-bold text-slate-700 truncate">{r.sub_category}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5 pl-3 font-medium">
                              {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                            </div>
                          </div>
                        ))
                      )}
                      {recs.length > 4 && <div className="text-center text-[10px] text-slate-400 font-bold">+{recs.length - 4} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Daily */}
          {view === "daily" && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="rounded-2xl bg-emerald-50/50 backdrop-blur border border-emerald-100/50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Records</p>
                  <p className="text-3xl font-black text-emerald-700">{selectedRecords.length}</p>
                </div>
                <div className="rounded-2xl bg-blue-50/50 backdrop-blur border border-blue-100/50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Farmers</p>
                  <p className="text-3xl font-black text-blue-700">{selectedRecords.reduce((s, r) => s + r.total_farmers, 0)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50/50 backdrop-blur border border-amber-100/50 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Harvest</p>
                  <p className="text-3xl font-black text-amber-700">{selectedRecords.reduce((s, r) => s + r.harvesting_output_bags, 0).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400">bags</p>
                </div>
              </div>

              {selectedRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 rounded-2xl bg-slate-50 p-5">
                    <Calendar size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">No records for this day</p>
                  <p className="text-xs font-medium text-slate-300 mt-1">Navigate to a day with data</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {grouped.map(([barangay, recs]) => {
                    const totalBags = recs.reduce((s, r) => s + r.harvesting_output_bags, 0);
                    const totalArea = recs.reduce((s, r) => s + r.planting_area_hectares, 0);
                    const totalDmg = recs.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
                    const commodities = [...new Set(recs.map((r) => r.commodity))];
                    return (
                      <div key={barangay} className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 overflow-hidden">
                        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-transparent px-5 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-emerald-600" />
                            <p className="text-sm font-black text-slate-700">{barangay}</p>
                          </div>
                          <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                            <span>{recs.length} entries</span>
                            {totalBags > 0 && <span className="text-emerald-600">{totalBags.toLocaleString()} bags</span>}
                            {totalArea > 0 && <span>{totalArea.toFixed(1)} ha</span>}
                            {totalDmg > 0 && <span className="text-red-500">{totalDmg.toFixed(1)} ha dmg</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 px-5 pt-2">
                          {commodities.map((c) => (
                            <span key={c} className="rounded-[1rem] px-2.5 py-0.5 text-[10px] font-bold" style={{ background: (COMMODITY_COLORS[c] || "#888") + "18", color: COMMODITY_COLORS[c] || "#888" }}>{c}</span>
                          ))}
                        </div>
                        <div className="divide-y divide-slate-100/50 px-5 pb-3 mt-2">
                          {recs.map((r) => {
                            const dmg = r.damage_pests_hectares + r.damage_calamity_hectares;
                            return (
                              <div key={r.id} className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{r.sub_category}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                      {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                                      {r.farmer_names ? ` · ${r.farmer_names.split(",").slice(0, 2).join(", ")}${r.farmer_names.split(",").length > 2 ? "..." : ""}` : ""}
                                    </p>
                                    {dmg > 0 && (
                                      <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5 font-bold">
                                        <AlertTriangle size={10} /> {dmg.toFixed(1)} ha damage
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  {r.harvesting_output_bags > 0 && <p className="font-mono text-xs font-black text-emerald-600">{r.harvesting_output_bags.toLocaleString()} bags</p>}
                                  {r.planting_area_hectares > 0 && <p className="text-[10px] font-medium text-slate-400">{r.planting_area_hectares} ha</p>}
                                  {r.commodity === "Fishery" && r.harvesting_fishery > 0 && <p className="font-mono text-xs font-black text-blue-600">{r.harvesting_fishery.toLocaleString()} fish</p>}
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
            </>
          )}
        </BentoCard>

        {/* ── RIGHT: Side Panel ──────────────────────────────────────────── */}
        {view !== "daily" && (
          <BentoCard variant="compact" className="flex flex-col">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedDayOfWeek}</p>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedDayFormatted}</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                {selectedRecords.length} record{selectedRecords.length !== 1 ? "s" : ""} submitted
              </p>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
              {selectedRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 rounded-2xl bg-slate-50 p-5">
                    <Calendar size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 mb-1">No records for this day</p>
                  <p className="text-xs font-medium text-slate-300">Select a day with records or add a new one</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {grouped.map(([barangay, recs]) => {
                    const totalFarmers = recs.reduce((s, r) => s + r.total_farmers, 0);
                    const totalBags = recs.reduce((s, r) => s + r.harvesting_output_bags, 0);
                    const commodities = [...new Set(recs.map((r) => r.commodity))];
                    return (
                      <div key={barangay} className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-50/50 px-4 py-3">
                          <div>
                            <p className="text-sm font-black text-slate-700">{barangay}</p>
                            <div className="flex gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                              <span>{recs.length} {recs.length === 1 ? "entry" : "entries"}</span>
                              <span>{totalFarmers} farmers</span>
                              {totalBags > 0 && <span>{totalBags.toLocaleString()} bags</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 px-4 pt-2">
                          {commodities.map((c) => (
                            <span key={c} className="rounded-[1rem] px-2.5 py-0.5 text-[10px] font-bold" style={{ background: (COMMODITY_COLORS[c] || "#888") + "18", color: COMMODITY_COLORS[c] || "#888" }}>{c}</span>
                          ))}
                        </div>
                        <div className="divide-y divide-slate-100/50 px-4 pb-2 mt-2">
                          {recs.map((r) => (
                            <div key={r.id} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: COMMODITY_COLORS[r.commodity] || "#888" }} />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 truncate">{r.sub_category}</p>
                                  <p className="text-[10px] font-medium text-slate-400 truncate">
                                    {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}{r.farmer_names ? ` · ${r.farmer_names.split(",").slice(0, 2).join(", ")}${r.farmer_names.split(",").length > 2 ? "..." : ""}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                {r.harvesting_output_bags > 0 && <p className="font-mono text-xs font-black text-emerald-600">{r.harvesting_output_bags.toLocaleString()} bags</p>}
                                {r.planting_area_hectares > 0 && <p className="text-[10px] font-medium text-slate-400">{r.planting_area_hectares} ha</p>}
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
            <div className="mt-5 border-t border-slate-100 pt-4 flex gap-3">
              <button
                onClick={() => openRecordForm()}
                className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 transition-all duration-300 shadow-xl shadow-emerald-200"
              >
                <Plus size={14} /> Add Record
              </button>
              <button
                onClick={() => openFarmerForm()}
                className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/40 bg-white/50 backdrop-blur px-4 py-3 text-sm font-bold text-slate-600 hover:bg-white/80 hover:text-emerald-700 transition-all duration-300"
              >
                <UserPlus size={14} /> Register Farmer
              </button>
            </div>
          </BentoCard>
        )}
      </div>

      <RecordFormDialog open={recordFormOpen} onClose={() => setRecordFormOpen(false)} mode="add" defaultBarangay={quickAddBarangay} />
      <FarmerFormDialog open={farmerFormOpen} onClose={() => setFarmerFormOpen(false)} mode="add" defaultBarangay={quickAddBarangay} />
    </>
  );
}
