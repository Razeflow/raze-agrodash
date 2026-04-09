"use client";
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import type { AgriRecord, Farmer } from "./data";
import { BARANGAYS } from "./data";
import { useAuth } from "./auth-context";
import { supabase } from "@/lib/supabase";

// ── Context shape ────────────────────────────────────────────────────────────
type AgriContextValue = {
  records: AgriRecord[];
  addRecord: (record: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">) => void;
  updateRecord: (id: string, record: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">) => void;
  deleteRecord: (id: string) => void;
  farmers: Farmer[];
  addFarmer: (farmer: Omit<Farmer, "id" | "created_at" | "updated_at">) => void;
  updateFarmer: (id: string, farmer: Omit<Farmer, "id" | "created_at" | "updated_at">) => void;
  deleteFarmer: (id: string) => void;
  getFarmersByIds: (ids: string[]) => Farmer[];
  farmersByBarangay: Record<string, Farmer[]>;
  totalFarmers: { male: number; female: number; total: number };
  totalProduction: { bags: number; tons: number };
  totalPlantingArea: number;
  totalDamagedArea: number;
  mostProducedCommodity: string;
  productionByCommodity: { name: string; bags: number; tons: number }[];
  productionBySubCategory: { name: string; commodity: string; bags: number; tons: number }[];
  farmersByCommodity: { name: string; male: number; female: number; total: number }[];
  damageRiskData: AgriRecord[];
  damageByCommodity: { name: string; area: number }[];
  damageByBarangay: Record<string, number>;
  mostAffectedBarangay: string;
  damagePercentage: number;
  affectedFarmerCount: number;
  damageTrend: "increasing" | "decreasing" | "stable";
  recordsByDate: Record<string, AgriRecord[]>;
  staleBarangays: { name: string; daysSinceUpdate: number | null; lastUpdate: string | null }[];
};

const AgriContext = createContext<AgriContextValue | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────
const validBarangays = new Set<string>(BARANGAYS);

function computeFarmerFields(farmerIds: string[], allFarmers: Farmer[]) {
  const linked = allFarmers.filter((f) => farmerIds.includes(f.id));
  return {
    farmer_names: linked.map((f) => f.name).join(", ") || "",
    farmer_male: linked.filter((f) => f.gender === "Male").length,
    farmer_female: linked.filter((f) => f.gender === "Female").length,
    total_farmers: linked.length,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AgriDataProvider({ children }: { children: ReactNode }) {
  const { isBarangayUser, userBarangay, isLoggedIn } = useAuth();
  const [records, setRecords] = useState<AgriRecord[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [, setLoaded] = useState(false);

  // Keep a ref in sync so setRecords callbacks always read the latest farmers
  const farmersRef = useRef<Farmer[]>(farmers);
  useEffect(() => { farmersRef.current = farmers; }, [farmers]);

  // ── Fetch from Supabase on mount & when login state changes ────────────
  useEffect(() => {
    if (!isLoggedIn) {
      setRecords([]);
      setFarmers([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        const [recordsRes, farmersRes] = await Promise.all([
          supabase.from('agri_records').select('*'),
          supabase.from('farmers').select('*'),
        ]);

        if (cancelled) return;

        if (recordsRes.data) {
          setRecords(recordsRes.data.filter((r: AgriRecord) => validBarangays.has(r.barangay)).map((r: AgriRecord) => ({ ...r, farmer_ids: r.farmer_ids || [] })));
        }
        if (farmersRes.data) {
          setFarmers(farmersRes.data);
        }
      } catch (err) { console.error("[AgriData] fetch error:", err); }
      if (!cancelled) setLoaded(true);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // ── Real-time subscriptions ────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;

    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agri_records' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRecord = payload.new as AgriRecord;
          if (validBarangays.has(newRecord.barangay)) {
            setRecords((prev) => prev.some((r) => r.id === newRecord.id) ? prev : [...prev, { ...newRecord, farmer_ids: newRecord.farmer_ids || [] }]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as AgriRecord;
          setRecords((prev) => prev.map((r) => r.id === updated.id ? { ...updated, farmer_ids: updated.farmer_ids || [] } : r));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setRecords((prev) => prev.filter((r) => r.id !== deleted.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farmers' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newFarmer = payload.new as Farmer;
          setFarmers((prev) => prev.some((f) => f.id === newFarmer.id) ? prev : [...prev, newFarmer]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Farmer;
          setFarmers((prev) => prev.map((f) => f.id === updated.id ? updated : f));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setFarmers((prev) => prev.filter((f) => f.id !== deleted.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn]);

  // ── Role-based visibility ────────────────────────────────────────────────
  const vr = useMemo(
    () => isBarangayUser && userBarangay ? records.filter((r) => r.barangay === userBarangay) : records,
    [records, isBarangayUser, userBarangay]
  );
  const vf = useMemo(
    () => isBarangayUser && userBarangay ? farmers.filter((f) => f.barangay === userBarangay) : farmers,
    [farmers, isBarangayUser, userBarangay]
  );

  // ── Record CRUD ──────────────────────────────────────────────────────────
  async function addRecord(data: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">) {
    const ff = computeFarmerFields(data.farmer_ids || [], farmersRef.current);
    const payload = { ...data, ...ff, farmer_ids: data.farmer_ids || [] };

    const { data: inserted, error } = await supabase.from('agri_records').insert(payload).select().single();
    if (!error && inserted) {
      setRecords((prev) => prev.some((r) => r.id === inserted.id) ? prev : [...prev, inserted]);
    }
  }

  async function updateRecord(id: string, data: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">) {
    const ff = computeFarmerFields(data.farmer_ids || [], farmersRef.current);
    const payload = { ...data, ...ff, farmer_ids: data.farmer_ids || [] };

    const { error } = await supabase.from('agri_records').update(payload).eq('id', id);
    if (!error) {
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, ...payload, updated_at: new Date().toISOString() } : r));
    }
  }

  async function deleteRecord(id: string) {
    const { error } = await supabase.from('agri_records').delete().eq('id', id);
    if (!error) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // ── Farmer CRUD ──────────────────────────────────────────────────────────
  async function addFarmer(data: Omit<Farmer, "id" | "created_at" | "updated_at">) {
    const { data: inserted, error } = await supabase.from('farmers').insert(data).select().single();
    if (!error && inserted) {
      setFarmers((prev) => prev.some((f) => f.id === inserted.id) ? prev : [...prev, inserted]);
    }
  }

  async function updateFarmer(id: string, data: Omit<Farmer, "id" | "created_at" | "updated_at">) {
    const { error } = await supabase.from('farmers').update(data).eq('id', id);
    if (error) return;

    // Update local farmer state
    setFarmers((prev) => prev.map((f) => (f.id === id ? { ...f, ...data, updated_at: new Date().toISOString() } : f)));

    // Recompute denormalized fields in all linked agri_records
    const currentFarmers = farmersRef.current;
    const updatedFarmers = currentFarmers.map((f) => f.id === id ? { ...f, ...data, updated_at: new Date().toISOString() } : f);

    // Find linked records and update them in Supabase
    const linkedRecords = records.filter((r) => r.farmer_ids?.includes(id));
    const updatePromises = linkedRecords.map((r) => {
      const ff = computeFarmerFields(r.farmer_ids, updatedFarmers);
      return supabase.from('agri_records').update(ff).eq('id', r.id);
    });
    await Promise.all(updatePromises);

    // Update local records state
    setRecords((prev) => prev.map((r) => r.farmer_ids?.includes(id) ? { ...r, ...computeFarmerFields(r.farmer_ids, updatedFarmers) } : r));
  }

  async function deleteFarmer(id: string) {
    const { error } = await supabase.from('farmers').delete().eq('id', id);
    if (error) return;

    setFarmers((prev) => prev.filter((f) => f.id !== id));

    // Remove farmer ID from linked records and recompute denormalized fields
    const remaining = farmersRef.current.filter((f) => f.id !== id);
    const linkedRecords = records.filter((r) => r.farmer_ids?.includes(id));

    const updatePromises = linkedRecords.map((r) => {
      const newIds = r.farmer_ids.filter((fid) => fid !== id);
      const ff = computeFarmerFields(newIds, remaining);
      return supabase.from('agri_records').update({ farmer_ids: newIds, ...ff }).eq('id', r.id);
    });
    await Promise.all(updatePromises);

    setRecords((prev) => prev.map((r) => {
      if (r.farmer_ids?.includes(id)) {
        const newIds = r.farmer_ids.filter((fid) => fid !== id);
        return { ...r, farmer_ids: newIds, ...computeFarmerFields(newIds, remaining) };
      }
      return r;
    }));
  }

  const getFarmersByIds = useCallback((ids: string[]) => farmers.filter((f) => ids.includes(f.id)), [farmers]);

  // ── Derived stats (all use vr/vf = visible records/farmers) ────────────
  const farmersByBarangay = useMemo(() => {
    const map: Record<string, Farmer[]> = {};
    BARANGAYS.forEach((b) => { map[b] = []; });
    vf.forEach((f) => { if (map[f.barangay]) map[f.barangay].push(f); });
    return map;
  }, [vf]);

  const totalFarmers = useMemo(() => {
    const male = vf.filter((f) => f.gender === "Male").length;
    const female = vf.filter((f) => f.gender === "Female").length;
    return { male, female, total: vf.length };
  }, [vf]);

  const totalProduction = useMemo(() => {
    const bags = vr.reduce((s, r) => s + r.harvesting_output_bags, 0);
    return { bags, tons: +(bags * 0.04).toFixed(2) };
  }, [vr]);

  const totalPlantingArea = useMemo(() => +vr.reduce((s, r) => s + r.planting_area_hectares, 0).toFixed(2), [vr]);
  const totalDamagedArea = useMemo(() => +vr.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0).toFixed(2), [vr]);

  const mostProducedCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + r.harvesting_output_bags; });
    const sorted = Object.entries(t).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "N/A";
  }, [vr]);

  const productionByCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + r.harvesting_output_bags; });
    return Object.entries(t).map(([name, bags]) => ({ name, bags, tons: +(bags * 0.04).toFixed(2) }));
  }, [vr]);

  const productionBySubCategory = useMemo(() => {
    const t: Record<string, { commodity: string; bags: number }> = {};
    vr.forEach((r) => { if (!t[r.sub_category]) t[r.sub_category] = { commodity: r.commodity, bags: 0 }; t[r.sub_category].bags += r.harvesting_output_bags; });
    return Object.entries(t).map(([name, v]) => ({ name, ...v, tons: +(v.bags * 0.04).toFixed(2) }));
  }, [vr]);

  const farmersByCommodity = useMemo(() => {
    const t: Record<string, { male: number; female: number; total: number }> = {};
    vr.forEach((r) => { if (!t[r.commodity]) t[r.commodity] = { male: 0, female: 0, total: 0 }; t[r.commodity].male += r.farmer_male; t[r.commodity].female += r.farmer_female; t[r.commodity].total += r.total_farmers; });
    return Object.entries(t).map(([name, v]) => ({ name, ...v }));
  }, [vr]);

  const damageRiskData = useMemo(
    () => vr.filter((r) => r.damage_pests_hectares > 0 || r.damage_calamity_hectares > 0 || r.pests_diseases !== "None" || r.calamity !== "None")
      .sort((a, b) => (b.damage_pests_hectares + b.damage_calamity_hectares) - (a.damage_pests_hectares + a.damage_calamity_hectares)),
    [vr]
  );

  const damageByCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + r.damage_pests_hectares + r.damage_calamity_hectares; });
    return Object.entries(t).map(([name, area]) => ({ name, area: +area.toFixed(2) })).sort((a, b) => b.area - a.area);
  }, [vr]);

  const damageByBarangay = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.barangay] = (t[r.barangay] || 0) + r.damage_pests_hectares + r.damage_calamity_hectares; });
    return t;
  }, [vr]);

  const mostAffectedBarangay = useMemo(() => {
    const entries = Object.entries(damageByBarangay);
    if (entries.length === 0) return "None";
    const max = entries.reduce((a, b) => b[1] > a[1] ? b : a);
    return max[1] > 0 ? max[0] : "None";
  }, [damageByBarangay]);

  const damagePercentage = useMemo(
    () => totalPlantingArea > 0 ? +(totalDamagedArea / totalPlantingArea * 100).toFixed(1) : 0,
    [totalDamagedArea, totalPlantingArea]
  );

  const affectedFarmerCount = useMemo(
    () => vr.filter((r) => r.damage_pests_hectares > 0 || r.damage_calamity_hectares > 0).reduce((s, r) => s + r.total_farmers, 0),
    [vr]
  );

  const damageTrend = useMemo<"increasing" | "decreasing" | "stable">(() => {
    const sorted = [...damageRiskData].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sorted.length < 2) return "stable";
    const mid = Math.floor(sorted.length / 2);
    const olderDmg = sorted.slice(0, mid).reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
    const newerDmg = sorted.slice(mid).reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
    if (newerDmg > olderDmg * 1.1) return "increasing";
    if (newerDmg < olderDmg * 0.9) return "decreasing";
    return "stable";
  }, [damageRiskData]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, AgriRecord[]> = {};
    vr.forEach((r) => { const day = new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); if (!map[day]) map[day] = []; map[day].push(r); });
    return map;
  }, [vr]);

  const [staleTimestamp, setStaleTimestamp] = useState(() => Date.now());
  useEffect(() => { setStaleTimestamp(Date.now()); }, [records]);

  const staleBarangays = useMemo(() => {
    return BARANGAYS.map((name) => {
      const br = records.filter((r) => r.barangay === name);
      if (br.length === 0) return { name, daysSinceUpdate: null, lastUpdate: null };
      const latest = br.reduce((max, r) => r.created_at > max ? r.created_at : max, "");
      return { name, daysSinceUpdate: Math.floor((staleTimestamp - new Date(latest).getTime()) / 86400000), lastUpdate: latest.slice(0, 10) };
    });
  }, [records, staleTimestamp]);

  const value: AgriContextValue = {
    records: vr, addRecord, updateRecord, deleteRecord,
    farmers: vf, addFarmer, updateFarmer, deleteFarmer, getFarmersByIds, farmersByBarangay,
    totalFarmers, totalProduction, totalPlantingArea, totalDamagedArea, mostProducedCommodity,
    productionByCommodity, productionBySubCategory, farmersByCommodity,
    damageRiskData, damageByCommodity, damageByBarangay, mostAffectedBarangay,
    damagePercentage, affectedFarmerCount, damageTrend, recordsByDate, staleBarangays,
  };

  return <AgriContext.Provider value={value}>{children}</AgriContext.Provider>;
}

export function useAgriData() {
  const ctx = useContext(AgriContext);
  if (!ctx) throw new Error("useAgriData must be used within AgriDataProvider");
  return ctx;
}
