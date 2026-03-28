"use client";
import { useState, useMemo, useEffect } from "react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { BARANGAYS } from "@/lib/data";
import type { Farmer } from "@/lib/data";
import {
  Search, UserPlus, Pencil, Trash2, MapPin, Users, X,
  User, Calendar, ChevronRight, ArrowLeft,
} from "lucide-react";
import FarmerFormDialog from "./FarmerFormDialog";

export default function FarmerRegistry() {
  const { farmers, farmersByBarangay, deleteFarmer } = useAgriData();
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
        const matchSearch = !q || f.name.toLowerCase().includes(q);
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
  function confirmDelete() {
    if (!deleteTarget) return;
    deleteFarmer(deleteTarget.id);
    if (selectedFarmer?.id === deleteTarget.id) setSelectedFarmer(null);
    setDeleteOpen(false); setDeleteTarget(null);
  }

  const gridClass = isBarangayUser
    ? "grid grid-cols-1 gap-4"
    : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4";

  return (
    <>
      <div className="fade-up delay-1 space-y-5">
        {/* ── Header bar ── */}
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Farmer Registry</h2>
              <p className="text-xs text-gray-400">
                {totalFiltered} farmer{totalFiltered !== 1 ? "s" : ""} across {barangayList.length} barangay{barangayList.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="h-9 rounded-full border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-green-400 focus:bg-white transition w-56"
                  placeholder="Search farmer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-9 appearance-none rounded-full border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 outline-none focus:border-green-400 focus:bg-white transition"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "All" | "Male" | "Female")}
                title="Filter by gender"
              >
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <button
                onClick={openGlobalAdd}
                className="flex items-center gap-1.5 rounded-full bg-green-600 p-2 px-4 text-xs font-semibold text-white hover:bg-green-700 transition"
                title="Register a new farmer"
              >
                <UserPlus size={14} /> Register Farmer
              </button>
            </div>
          </div>
        </div>

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
                className={`rounded-2xl border bg-white shadow-sm hover:shadow-md hover:border-green-300 cursor-pointer p-5 transition-all duration-200 ${
                  dimmed ? "opacity-40 border-gray-100" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-gray-800 truncate block">{brgy}</span>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                    {all.length}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    {male} male
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-pink-400" />
                    {female} female
                  </span>
                </div>
                {dimmed && <p className="text-[10px] text-gray-400 mt-2">No matches</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Barangay Modal ── */}
      {activeBarangay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="shrink-0 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {selectedFarmer && (
                    <button
                      onClick={() => setSelectedFarmer(null)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition"
                      title="Back to list"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <MapPin size={15} />
                    </div>
                    <h3 className="text-base font-bold text-gray-800">{activeBarangay}</h3>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-500 ml-10">
                {modalAllFarmers.length} farmer{modalAllFarmers.length !== 1 ? "s" : ""} &middot; {modalMale} male &middot; {modalFemale} female
              </p>
              {!selectedFarmer && (
                <button
                  onClick={openAddInBarangay}
                  className="mt-3 flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
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
                  {/* Large avatar */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
                      selectedFarmer.gender === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-500"
                    }`}>
                      {selectedFarmer.name.charAt(0).toUpperCase()}
                    </div>
                    <h4 className="text-lg font-bold text-gray-800">{selectedFarmer.name}</h4>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      selectedFarmer.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-500"
                    }`}>
                      {selectedFarmer.gender}
                    </span>
                  </div>

                  {/* 2x2 info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: User, label: "Full Name", value: selectedFarmer.name },
                      { icon: Users, label: "Gender", value: selectedFarmer.gender },
                      { icon: MapPin, label: "Barangay", value: selectedFarmer.barangay },
                      { icon: Calendar, label: "Registered", value: new Date(selectedFarmer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className="text-gray-400" />
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => openEdit(selectedFarmer)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                    >
                      <Pencil size={13} /> Edit Farmer
                    </button>
                    <button
                      onClick={() => openDelete(selectedFarmer)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition"
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
                      <Users size={32} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-semibold text-gray-500">No farmers registered</p>
                      <p className="text-xs text-gray-400 mt-1 mb-4">
                        {search.trim() ? "No farmers match your search." : "Click below to register the first farmer."}
                      </p>
                      {!search.trim() && (
                        <button
                          onClick={openAddInBarangay}
                          className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
                        >
                          <UserPlus size={13} /> Register Farmer
                        </button>
                      )}
                    </div>
                  ) : (
                    modalFarmers.map((f) => (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedFarmer(f)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedFarmer(f); }}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:border-green-200 hover:bg-green-50/30 p-3 cursor-pointer transition-all group"
                      >
                        {/* Avatar */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          f.gender === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-500"
                        }`}>
                          {f.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                              f.gender === "Male" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-400"
                            }`}>
                              {f.gender}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </div>

                        {/* Chevron */}
                        <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-green-500 transition" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FarmerFormDialog ── */}
      <FarmerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        initialData={editFarmer}
        defaultBarangay={formDefaultBarangay}
      />

      {/* ── Delete confirmation ── */}
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDeleteOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-lg font-bold text-gray-800">Delete Farmer</h2>
            <p className="mb-2 text-sm text-gray-600">
              Are you sure? This farmer will be unlinked from all commodity records.
            </p>
            <div className="mb-5 rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-700">{deleteTarget.name}</p>
              <p className="text-xs text-gray-500">{deleteTarget.gender} &middot; {deleteTarget.barangay}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} className="rounded-lg border border-gray-200 p-2 px-4 text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={confirmDelete} className="rounded-lg bg-red-500 p-2 px-5 text-sm font-semibold text-white hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
