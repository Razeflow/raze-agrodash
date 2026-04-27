"use client";
import { useState, useMemo, useEffect } from "react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { BARANGAYS, formatPeriod, ORG_TYPE_LABELS, formatHouseholdSubsidySummary } from "@/lib/data";
import type { Farmer, Household } from "@/lib/data";
import {
  Search, UserPlus, Pencil, Trash2, MapPin, Users, X,
  User, Calendar, ChevronRight, ArrowLeft, Home, Building2, UserMinus, HandCoins,
} from "lucide-react";
import FarmerFormDialog from "./FarmerFormDialog";
import HouseholdEditDialog from "./HouseholdEditDialog";
import HouseholdBrowseDialog from "./HouseholdBrowseDialog";
import BentoCard from "@/components/ui/BentoCard";
import DialogPortal from "@/components/ui/DialogPortal";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";

function farmerAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / 31557600000));
}

export default function FarmerRegistry() {
  const {
    farmersByBarangay,
    farmers,
    households,
    deleteFarmer,
    records,
    getHousehold,
    organizations,
    updateFarmer,
    getOrganizationIdsForFarmer,
    getSubsidiesForHousehold,
  } = useAgriData();
  const { isBarangayUser, userBarangay } = useAuth();

  // ── Global filters ──
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");

  // ── Modal state ──
  const [activeBarangay, setActiveBarangay] = useState<string | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  // ── CRUD dialog ──
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editFarmer, setEditFarmer] = useState<Farmer | undefined>();
  const [formDefaultBarangay, setFormDefaultBarangay] = useState<string | undefined>();

  // ── Delete confirmation ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Farmer | null>(null);

  const [householdEdit, setHouseholdEdit] = useState<Household | null>(null);
  const [householdBrowseOpen, setHouseholdBrowseOpen] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  // ── Animated mount for inline modals ──
  const brgyModal = useAnimatedMount(!!activeBarangay);
  const delModal = useAnimatedMount(deleteOpen);

  // ── Escape key closes modal ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteOpen) { setDeleteOpen(false); return; }
        if (formOpen) return; // let FarmerFormDialog handle its own escape
        if (selectedFarmer) { setSelectedFarmer(null); return; }
        if (activeBarangay) { setActiveBarangay(null); return; }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteOpen, formOpen, selectedFarmer, activeBarangay]);

  // ── Derived data ──
  const barangayList = useMemo(() => {
    if (isBarangayUser && userBarangay) return [userBarangay];
    return [...BARANGAYS];
  }, [isBarangayUser, userBarangay]);

  const filteredByBarangay = useMemo(() => {
    const result: Record<string, Farmer[]> = {};
    const q = search.toLowerCase().trim();
    for (const brgy of barangayList) {
      const all = farmersByBarangay[brgy] || [];
      result[brgy] = all.filter((f) => {
        const matchGender = genderFilter === "All" || f.gender === genderFilter;
        const matchSearch =
          !q ||
          f.name.toLowerCase().includes(q) ||
          (f.rsbsa_number && f.rsbsa_number.toLowerCase().includes(q));
        return matchGender && matchSearch;
      });
    }
    return result;
  }, [farmersByBarangay, barangayList, search, genderFilter]);

  const totalFiltered = useMemo(
    () => Object.values(filteredByBarangay).reduce((s, a) => s + a.length, 0),
    [filteredByBarangay],
  );

  // Farmers for the active modal
  const modalFarmers = activeBarangay ? (filteredByBarangay[activeBarangay] || []) : [];
  const modalAllFarmers = activeBarangay ? (farmersByBarangay[activeBarangay] || []) : [];
  const modalMale = modalAllFarmers.filter((f) => f.gender === "Male").length;
  const modalFemale = modalAllFarmers.filter((f) => f.gender === "Female").length;

  // ── Handlers ──
  function closeModal() { setActiveBarangay(null); setSelectedFarmer(null); }
  function openBarangayModal(brgy: string) { setActiveBarangay(brgy); setSelectedFarmer(null); }

  function openGlobalAdd() {
    setFormMode("add"); setEditFarmer(undefined); setFormDefaultBarangay(undefined); setFormOpen(true);
  }
  function openAddInBarangay() {
    setFormMode("add"); setEditFarmer(undefined); setFormDefaultBarangay(activeBarangay || undefined); setFormOpen(true);
  }
  function openEdit(f: Farmer) {
    setFormMode("edit"); setEditFarmer(f); setFormDefaultBarangay(undefined); setFormOpen(true);
  }
  function openDelete(f: Farmer) { setDeleteTarget(f); setDeleteOpen(true); }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteFarmer(deleteTarget.id);
    if (selectedFarmer?.id === deleteTarget.id) setSelectedFarmer(null);
    setDeleteOpen(false); setDeleteTarget(null);
  }

  const listGrouped = useMemo(() => {
    const byH = new Map<string, Farmer[]>();
    const noH: Farmer[] = [];
    modalFarmers.forEach((f) => {
      if (!f.household_id) noH.push(f);
      else {
        const arr = byH.get(f.household_id) || [];
        arr.push(f);
        byH.set(f.household_id, arr);
      }
    });
    const householdIds = [...byH.keys()].sort((a, b) => {
      const na = getHousehold(a)?.display_name || a;
      const nb = getHousehold(b)?.display_name || b;
      return na.localeCompare(nb);
    });
    return { byH, householdIds, noH };
  }, [modalFarmers, getHousehold]);

  async function moveOutOfHousehold(f: Farmer) {
    setRegistryError(null);
    const res = await updateFarmer(f.id, {
      name: f.name,
      gender: f.gender,
      barangay: f.barangay,
      household_id: null,
      is_household_head: false,
      rsbsa_number: f.rsbsa_number,
      birth_date: f.birth_date,
      civil_status: f.civil_status,
      photo_url: f.photo_url,
    });
    if (!res.ok) {
      setRegistryError(res.message);
      return;
    }
    if (selectedFarmer?.id === f.id) {
      setSelectedFarmer({
        ...f,
        household_id: null,
        is_household_head: false,
      });
    }
  }

  const gridClass = isBarangayUser
    ? "grid grid-cols-1 gap-4"
    : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4";

  return (
    <>
      <div className="fade-up delay-1 space-y-5">
        {/* ── Header bar ── */}
        <BentoCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Farmer Registry</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalFiltered} farmer{totalFiltered !== 1 ? "s" : ""} across {barangayList.length} barangay{barangayList.length !== 1 ? "s" : ""}
              </p>
              {registryError && (
                <p className="mt-2 text-xs font-medium text-red-600 rounded-xl bg-red-50/80 border border-red-100 px-3 py-2">{registryError}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-9 rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition w-56"
                  placeholder="Search farmer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-9 appearance-none rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 text-xs text-slate-700 outline-none focus:border-emerald-400 focus:bg-white transition"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "All" | "Male" | "Female")}
                title="Filter by gender"
              >
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setRegistryError(null);
                  setHouseholdBrowseOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-[1.5rem] border border-emerald-200/60 bg-emerald-50/80 p-2 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/90 transition"
                title="Browse households, RFFA notes, and assistance lines"
              >
                <HandCoins size={14} /> Households &amp; assistance
              </button>
              <button
                onClick={openGlobalAdd}
                className="flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 p-2 px-4 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                title="Register a new farmer"
              >
                <UserPlus size={14} /> Register Farmer
              </button>
            </div>
          </div>
        </BentoCard>

        {/* ── Summary Cards Grid ── */}
        <div className={gridClass}>
          {barangayList.map((brgy) => {
            const all = farmersByBarangay[brgy] || [];
            const filtered = filteredByBarangay[brgy] || [];
            const male = all.filter((f) => f.gender === "Male").length;
            const female = all.filter((f) => f.gender === "Female").length;
            const dimmed = search.trim() && filtered.length === 0;

            return (
              <div
                key={brgy}
                role="button"
                tabIndex={0}
                onClick={() => openBarangayModal(brgy)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openBarangayModal(brgy); }}
                className={`rounded-[2rem] bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg hover:shadow-2xl hover:shadow-emerald-100/50 cursor-pointer p-5 transition-all duration-500 group ${
                  dimmed ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate block">{brgy}</span>
                  </div>
                  <span className="inline-flex items-center rounded-[1rem] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    {all.length}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{male} male</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-pink-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{female} female</span>
                  </span>
                </div>
                {dimmed && <p className="text-[10px] text-slate-400 mt-2">No matches</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Barangay Modal ── */}
      {brgyModal.mounted && activeBarangay && (
        <DialogPortal>
        <div className="fixed inset-0 lg:left-24 z-50 overflow-y-auto">
          <div className={`fixed inset-0 dialog-overlay ${brgyModal.visible ? "dialog-overlay-visible" : ""}`} onClick={closeModal} />
          <div className="flex min-h-full items-center justify-center p-4">
          <div className={`relative z-10 w-full max-w-xl max-h-[85vh] flex flex-col rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 shadow-2xl overflow-hidden dialog-panel ${brgyModal.visible ? "dialog-panel-visible" : ""}`}>

            {/* Modal header */}
            <div className="shrink-0 border-b border-white/30 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {selectedFarmer && (
                    <button
                      onClick={() => setSelectedFarmer(null)}
                      className="rounded-2xl p-1.5 text-slate-400 hover:bg-white/50 transition"
                      title="Back to list"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <MapPin size={15} className="text-emerald-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{activeBarangay}</h3>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-2xl p-1.5 text-slate-400 hover:bg-white/50 transition"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-500 ml-10">
                {modalAllFarmers.length} farmer{modalAllFarmers.length !== 1 ? "s" : ""} &middot; {modalMale} male &middot; {modalFemale} female
              </p>
              {!selectedFarmer && (
                <button
                  onClick={openAddInBarangay}
                  className="mt-3 flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  <UserPlus size={13} /> Add Farmer
                </button>
              )}
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto">
              {selectedFarmer ? (
                /* ── Farmer Detail View ── */
                <div className="p-6 space-y-5">
                  {(() => {
                    const hh = selectedFarmer.household_id ? getHousehold(selectedFarmer.household_id) : undefined;
                    const orgIds = getOrganizationIdsForFarmer(selectedFarmer.id);
                    const orgNames = orgIds
                      .map((id) => organizations.find((o) => o.id === id))
                      .filter(Boolean)
                      .map((o) => `${o!.name} (${ORG_TYPE_LABELS[o!.org_type]})`)
                      .join(", ");
                    return (
                      <>
                        <div className="flex flex-col items-center gap-2">
                          {selectedFarmer.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedFarmer.photo_url}
                              alt=""
                              className="h-20 w-20 rounded-2xl object-cover border border-white/40 shadow-md"
                            />
                          ) : (
                            <div
                              className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ${
                                selectedFarmer.gender === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-500"
                              }`}
                            >
                              {selectedFarmer.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <h4 className="text-lg font-bold text-slate-800">{selectedFarmer.name}</h4>
                          <span
                            className={`inline-flex items-center rounded-[1rem] px-2.5 py-0.5 text-[11px] font-semibold ${
                              selectedFarmer.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-500"
                            }`}
                          >
                            {selectedFarmer.gender}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { icon: User, label: "RSBSA", value: selectedFarmer.rsbsa_number || "—" },
                            { icon: Calendar, label: "Age (yrs)", value: farmerAge(selectedFarmer.birth_date) },
                            { icon: User, label: "Civil status", value: selectedFarmer.civil_status || "—" },
                            { icon: MapPin, label: "Barangay", value: selectedFarmer.barangay },
                          ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon size={12} className="text-slate-400" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                              </div>
                              <p className="text-sm font-medium text-slate-800">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-2xl bg-emerald-50/40 border border-emerald-100/50 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1">
                              <Home size={12} /> Household
                            </p>
                            {hh && (
                              <button
                                type="button"
                                onClick={() => setHouseholdEdit(hh)}
                                className="text-[10px] font-bold text-emerald-700 hover:underline"
                              >
                                Edit household and subsidies
                              </button>
                            )}
                          </div>
                          {hh ? (
                            <>
                              <p className="text-sm font-semibold text-slate-800">{hh.display_name}</p>
                              <p className="text-xs text-slate-600">
                                Shared area: {hh.farming_area_hectares ?? 0} ha
                              </p>
                              {hh.rffa_subsidies_notes ? (
                                <p className="text-xs text-slate-500 whitespace-pre-wrap">{hh.rffa_subsidies_notes}</p>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No RFFA / subsidy notes yet.</p>
                              )}
                              {(() => {
                                const sm = formatHouseholdSubsidySummary(getSubsidiesForHousehold(hh.id));
                                return sm ? (
                                  <p className="text-xs text-emerald-900/90 font-medium mt-2 line-clamp-3">Assistance items: {sm}</p>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <p className="text-xs text-amber-700">Not in a household — assign when editing the farmer.</p>
                          )}
                          {hh && (
                            <button
                              type="button"
                              onClick={() => moveOutOfHousehold(selectedFarmer)}
                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[1.5rem] border border-slate-200 bg-white/70 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              <UserMinus size={14} /> Move out of household
                            </button>
                          )}
                          {hh &&
                            (() => {
                              const members = farmers
                                .filter((f) => f.household_id === hh.id)
                                .sort(
                                  (a, b) =>
                                    Number(b.is_household_head) - Number(a.is_household_head) ||
                                    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
                                );
                              if (members.length === 0) return null;
                              return (
                                <div className="mt-3 pt-3 border-t border-emerald-100/80">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-2">
                                    Household members ({members.length})
                                  </p>
                                  <ul className="space-y-1.5">
                                    {members.map((m) => (
                                      <li
                                        key={m.id}
                                        className="flex items-center justify-between gap-2 rounded-xl bg-white/50 px-2.5 py-1.5 text-xs text-slate-800"
                                      >
                                        <span className="truncate font-medium">
                                          {m.name}
                                          {m.id === selectedFarmer.id ? (
                                            <span className="text-slate-400 font-normal"> · viewing</span>
                                          ) : null}
                                        </span>
                                        {m.is_household_head ? (
                                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                            Head
                                          </span>
                                        ) : (
                                          <span className="shrink-0 text-[10px] text-slate-400">Member</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}
                        </div>

                        <div className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Building2 size={12} className="text-slate-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organizations</p>
                          </div>
                          <p className="text-sm text-slate-700">{orgNames || "—"}</p>
                        </div>
                      </>
                    );
                  })()}

                  {/* Linked commodity records */}
                  {(() => {
                    const linked = records.filter((r) => r.farmer_ids?.includes(selectedFarmer.id));
                    return (
                      <div className="pt-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Linked Records ({linked.length})</p>
                        {linked.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No linked commodity records</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                            {linked.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-white/50 backdrop-blur border border-white/30 px-3 py-2 text-xs">
                                <span className="h-2 w-2 rounded-full" style={{ background: r.commodity === "Rice" ? "#16a34a" : r.commodity === "Corn" ? "#ca8a04" : r.commodity === "Fishery" ? "#0284c7" : r.commodity === "High Value Crops" ? "#9333ea" : "#ea580c" }} />
                                <span className="font-medium text-slate-700">{r.commodity} — {r.sub_category}</span>
                                <span className="ml-auto text-slate-400">{formatPeriod(r.period_month, r.period_year)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => openEdit(selectedFarmer)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-[1.5rem] bg-blue-50 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                    >
                      <Pencil size={13} /> Edit Farmer
                    </button>
                    <button
                      onClick={() => openDelete(selectedFarmer)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-[1.5rem] bg-red-50 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition"
                    >
                      <Trash2 size={13} /> Delete Farmer
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Farmer List View ── */
                <div className="p-4 space-y-2">
                  {modalFarmers.length === 0 ? (
                    <div className="py-12 text-center">
                      <Users size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-500">No farmers registered</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        {search.trim() ? "No farmers match your search." : "Click below to register the first farmer."}
                      </p>
                      {!search.trim() && (
                        <button
                          onClick={openAddInBarangay}
                          className="inline-flex items-center gap-1.5 rounded-[1.5rem] bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          <UserPlus size={13} /> Register Farmer
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {listGrouped.householdIds.map((hid) => {
                        const members = listGrouped.byH.get(hid) || [];
                        const hh = getHousehold(hid);
                        return (
                          <div key={hid}>
                            <div className="flex items-center justify-between px-1 pb-1.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                <Home size={11} />
                                {hh?.display_name || "Household"}
                                <span className="font-mono text-slate-300">({members.length})</span>
                              </p>
                              {hh && (
                                <button
                                  type="button"
                                  onClick={() => setHouseholdEdit(hh)}
                                  className="text-[10px] font-bold text-emerald-600 hover:underline"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {members.map((f) => (
                                <div
                                  key={f.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedFarmer(f)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedFarmer(f); }}
                                  className="flex items-center gap-3 rounded-2xl bg-white/50 backdrop-blur border border-white/30 hover:border-emerald-200 hover:bg-emerald-50/30 p-3 cursor-pointer transition-all group"
                                >
                                  {f.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={f.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-2xl object-cover" />
                                  ) : (
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                                      f.gender === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-500"
                                    }`}>
                                      {f.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                      <span className={`inline-flex items-center rounded-[1rem] px-1.5 py-0 text-[10px] font-semibold ${
                                        f.gender === "Male" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-400"
                                      }`}>
                                        {f.gender}
                                      </span>
                                      {f.rsbsa_number && (
                                        <span className="text-[10px] text-slate-500">RSBSA {f.rsbsa_number}</span>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-emerald-500 transition" />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {listGrouped.noH.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 px-1 pb-1.5">
                            No household ({listGrouped.noH.length})
                          </p>
                          <div className="space-y-2">
                            {listGrouped.noH.map((f) => (
                              <div
                                key={f.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedFarmer(f)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedFarmer(f); }}
                                className="flex items-center gap-3 rounded-2xl bg-amber-50/30 backdrop-blur border border-amber-100/50 hover:border-emerald-200 hover:bg-emerald-50/30 p-3 cursor-pointer transition-all group"
                              >
                                {f.photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-2xl object-cover" />
                                ) : (
                                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                                    f.gender === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-500"
                                  }`}>
                                    {f.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                                  <p className="text-[10px] text-amber-700 mt-0.5">Assign household via Edit</p>
                                </div>
                                <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-emerald-500 transition" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
        </DialogPortal>
      )}

      {/* ── FarmerFormDialog ── */}
      <FarmerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        initialData={editFarmer}
        defaultBarangay={formDefaultBarangay}
      />

      <HouseholdBrowseDialog
        open={householdBrowseOpen}
        onClose={() => setHouseholdBrowseOpen(false)}
        households={households}
        farmers={farmers}
        getSubsidiesForHousehold={getSubsidiesForHousehold}
        onEditHousehold={(h) => {
          setHouseholdBrowseOpen(false);
          setHouseholdEdit(h);
        }}
      />

      <HouseholdEditDialog open={!!householdEdit} onClose={() => setHouseholdEdit(null)} household={householdEdit} />

      {/* ── Delete confirmation ── */}
      {delModal.mounted && deleteTarget && (
        <DialogPortal>
        <div className="fixed inset-0 lg:left-24 z-[60] overflow-y-auto">
          <div className={`fixed inset-0 dialog-overlay ${delModal.visible ? "dialog-overlay-visible" : ""}`} onClick={() => setDeleteOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
          <div className={`relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-6 shadow-2xl dialog-panel ${delModal.visible ? "dialog-panel-visible" : ""}`}>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Delete Farmer</h2>
            <p className="mb-2 text-sm text-slate-600">
              Are you sure? This farmer will be unlinked from all commodity records.
            </p>
            <div className="mb-5 rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-3">
              <p className="text-sm font-semibold text-slate-700">{deleteTarget.name}</p>
              <p className="text-xs text-slate-500">{deleteTarget.gender} &middot; {deleteTarget.barangay}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} className="rounded-[1.5rem] border border-slate-200/50 p-2 px-4 text-sm text-slate-600 hover:bg-white/50 transition">Cancel</button>
              <button onClick={confirmDelete} className="rounded-[1.5rem] bg-red-500 p-2 px-5 text-sm font-semibold text-white hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
          </div>
        </div>
        </DialogPortal>
      )}
    </>
  );
}
