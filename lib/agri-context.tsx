"use client";
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import {
  isSubsidyCategory,
  isFarmerAssetCategory,
  isLifecycleStatus,
  type AgriRecord,
  type Farmer,
  type FarmerAsset,
  type FarmerAssetCategory,
  type Household,
  type HouseholdSubsidy,
  type LifecycleStatus,
  type Organization,
  type FarmerOrganizationRow,
  type OrgType,
  type SubsidyCategory,
} from "./data";
import {
  BARANGAYS,
  normalizeCalamitySubCategory,
  normalizeCommodity,
  numField,
} from "./data";
import {
  filterRecords,
  getBarangaySummary,
  recordGroup,
} from "@/lib/domain/metrics";
import {
  MetricsContext,
  MetricsProvider,
  type MetricsContextValue,
} from "@/lib/contexts/metrics-context";
import {
  ProgramsContext,
  ProgramsProvider,
  type ProgramsContextValue,
  type AddOrganizationResult,
  type AddHouseholdSubsidyResult,
} from "@/lib/contexts/programs-context";
import {
  FarmersContext,
  FarmersProvider,
  type FarmersContextValue,
  type AddFarmerInput,
  type AddFarmerResult,
  type AddFarmerAssetResult,
} from "@/lib/contexts/farmers-context";
import {
  RecordsContext,
  RecordsProvider,
  type RecordsContextValue,
  type AddRecordResult,
} from "@/lib/contexts/records-context";
import { commodityGroupForCommodity } from "@/lib/domain/commodity";
import { isHistoricalOnly } from "@/lib/domain/lifecycle";
import { validateHouseholdCropAllocation } from "@/lib/domain/allocation";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase/client";
import { friendlyDbError } from "./supabase/errors";
import { sortBy } from "./sort";
import { fullNameSortKey, lastNameSortKey } from "./name";
import { agriRecordInsertRow, farmerInsertRow } from "./insert-rows";
import {
  normalizeAgriRecord,
  normalizeFarmer,
  normalizeFarmerAsset,
  normalizeHouseholdSubsidy,
} from "./normalize";

// Phase 5 / step F: helper extractions
//   - friendlyDbError      → lib/supabase/errors.ts
//   - farmer / record builders → lib/insert-rows.ts
//   - normalize / derive helpers → lib/normalize.ts
//
// Result types still re-export here for any legacy `import { ... } from "@/lib/agri-context"`
// callers; new code should import from the specific context files directly.
export type {
  AddFarmerInput,
  AddFarmerResult,
  AddFarmerAssetResult,
} from "@/lib/contexts/farmers-context";
export type { AddRecordResult } from "@/lib/contexts/records-context";
export type { AddOrganizationResult, AddHouseholdSubsidyResult } from "@/lib/contexts/programs-context";
export type MutationResult = { ok: true } | { ok: false; message: string };

/* ── context type ─────────────────────────────────────────────────── */
/* Phase 5: per-domain context types live in `lib/contexts/*-context.tsx`.
   The orchestrator below builds three split value objects (Programs / Farmers
   / Records) and hands each to the corresponding provider. The legacy
   `useAgriData()` facade reads from all four contexts (those three +
   MetricsContext) and merges them so existing consumers don't break. */

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

export function AgriDataProvider({ children }: { children: ReactNode }) {
  const { isBarangayUser, userBarangay, isLoggedIn } = useAuth();
  const [records, setRecords] = useState<AgriRecord[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [farmerOrganizations, setFarmerOrganizations] = useState<FarmerOrganizationRow[]>([]);
  const [householdSubsidies, setHouseholdSubsidies] = useState<HouseholdSubsidy[]>([]);
  const [farmerAssets, setFarmerAssets] = useState<FarmerAsset[]>([]);
  const [, setLoaded] = useState(false);

  const farmersRef = useRef<Farmer[]>(farmers);
  useEffect(() => { farmersRef.current = farmers; }, [farmers]);

  const recordsRef = useRef<AgriRecord[]>(records);
  useEffect(() => { recordsRef.current = records; }, [records]);

  const householdsRef = useRef<Household[]>(households);
  useEffect(() => { householdsRef.current = households; }, [households]);

  /* ── Load from Supabase on login ──────────────────────────────── */
  useEffect(() => {
    if (!isLoggedIn) {
      setRecords([]);
      setFarmers([]);
      setHouseholds([]);
      setOrganizations([]);
      setFarmerOrganizations([]);
      setHouseholdSubsidies([]);
      setFarmerAssets([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [recordsRes, farmersRes, householdsRes, orgsRes, farmerOrgsRes, subsRes, assetsRes] = await Promise.all([
          supabase.from("agri_records").select("*"),
          supabase.from("farmers").select("*"),
          supabase.from("households").select("*"),
          supabase.from("organizations").select("*"),
          supabase.from("farmer_organizations").select("*"),
          supabase.from("household_subsidies").select("*"),
          supabase.from("farmer_assets").select("*"),
        ]);
        if (cancelled) return;

        const errs = [recordsRes, farmersRes, householdsRes, orgsRes, farmerOrgsRes, subsRes, assetsRes]
          .map((r) => r.error)
          .filter(Boolean);
        if (errs.length > 0) {
          console.error("[AgriData] Supabase load errors:", errs);
        }

        setRecords(
          (recordsRes.data ?? [])
            .filter((r: Record<string, unknown>) => validBarangays.has(String(r.barangay)))
            .map((r: Record<string, unknown>) => normalizeAgriRecord(r)),
        );
        setFarmers((farmersRes.data ?? []).map((r: Record<string, unknown>) => normalizeFarmer(r)));
        setHouseholds((householdsRes.data ?? []) as Household[]);
        setOrganizations((orgsRes.data ?? []) as Organization[]);
        setFarmerOrganizations((farmerOrgsRes.data ?? []) as FarmerOrganizationRow[]);
        setHouseholdSubsidies(
          (subsRes.data ?? []).map((r: Record<string, unknown>) => normalizeHouseholdSubsidy(r)),
        );
        setFarmerAssets(
          (assetsRes.data ?? []).map((r: Record<string, unknown>) => normalizeFarmerAsset(r)),
        );
      } catch (err) {
        if (!cancelled) console.error("[AgriData] Supabase load error:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  /* ── Memoised visible slices ──────────────────────────────────── */

  const vr = useMemo(
    () => (isBarangayUser && userBarangay ? records.filter((r) => r.barangay === userBarangay) : records),
    [records, isBarangayUser, userBarangay],
  );
  const vf = useMemo(() => {
    const visible = isBarangayUser && userBarangay ? farmers.filter((f) => f.barangay === userBarangay) : farmers;
    return sortBy(visible, (f) => lastNameSortKey(f.name) || fullNameSortKey(f.name));
  }, [farmers, isBarangayUser, userBarangay]);

  const vh = useMemo(() => {
    const visible = isBarangayUser && userBarangay ? households.filter((h) => h.barangay === userBarangay) : households;
    return sortBy(visible, (h) => h.display_name?.trim() || h.id);
  }, [households, isBarangayUser, userBarangay]);

  const vo = useMemo(() => {
    const visible =
      isBarangayUser && userBarangay
        ? organizations.filter((o) => !o.barangay || o.barangay === userBarangay)
        : organizations;
    return sortBy(visible, (o) => o.name);
  }, [organizations, isBarangayUser, userBarangay]);

  const vSubs = useMemo(() => {
    const hid = new Set(vh.map((h) => h.id));
    return householdSubsidies.filter((s) => hid.has(s.household_id));
  }, [householdSubsidies, vh]);

  const vAssets = useMemo(() => {
    const fid = new Set(vf.map((f) => f.id));
    return farmerAssets.filter((a) => fid.has(a.farmer_id));
  }, [farmerAssets, vf]);

  const getHousehold = useCallback(
    (id: string | null) => (id ? households.find((h) => h.id === id) : undefined),
    [households],
  );

  const getOrganizationIdsForFarmer = useCallback(
    (farmerId: string) => farmerOrganizations.filter((r) => r.farmer_id === farmerId).map((r) => r.organization_id),
    [farmerOrganizations],
  );

  /** Use full `householdSubsidies` (not `vSubs`) so lines added in-session always appear; RLS already scoped the load. */
  const getSubsidiesForHousehold = useCallback(
    (householdId: string) => householdSubsidies.filter((s) => s.household_id === householdId),
    [householdSubsidies],
  );

  const getAssetsForFarmer = useCallback(
    (farmerId: string) => vAssets.filter((a) => a.farmer_id === farmerId),
    [vAssets],
  );

  /* ── Household Subsidies CRUD ─────────────────────────────────── */

  async function addHouseholdSubsidy(row: {
    household_id: string;
    category: SubsidyCategory;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    amount_php?: number | null;
    program_source?: string | null;
    received_date?: string | null;
    notes?: string | null;
  }): Promise<AddHouseholdSubsidyResult> {
    const now = new Date().toISOString();
    const s: HouseholdSubsidy = {
      id: crypto.randomUUID(),
      household_id: row.household_id,
      category: row.category,
      product_detail: row.product_detail ?? null,
      quantity: row.quantity ?? null,
      unit: row.unit ?? null,
      amount_php: row.amount_php ?? null,
      program_source: row.program_source ?? null,
      received_date: row.received_date || null,
      notes: row.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase.from("household_subsidies").insert(s);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setHouseholdSubsidies((prev) => [...prev, s]);
    return { ok: true, subsidy: s };
  }

  async function updateHouseholdSubsidy(
    id: string,
    patch: Partial<{
      category: SubsidyCategory;
      product_detail: string | null;
      quantity: number | null;
      unit: string | null;
      amount_php: number | null;
      program_source: string | null;
      received_date: string | null;
      notes: string | null;
    }>,
  ): Promise<MutationResult> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("household_subsidies")
      .update({ ...patch, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setHouseholdSubsidies((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updated_at: now } : x)),
    );
    return { ok: true };
  }

  async function deleteHouseholdSubsidy(id: string): Promise<MutationResult> {
    const { error } = await supabase.from("household_subsidies").delete().eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setHouseholdSubsidies((prev) => prev.filter((x) => x.id !== id));
    return { ok: true };
  }

  /* ── Farmer Assets CRUD ───────────────────────────────────────── */

  async function addFarmerAsset(row: {
    farmer_id: string;
    category: FarmerAssetCategory;
    sub_category?: string | null;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    area_hectares?: number | null;
    acquired_date?: string | null;
    notes?: string | null;
  }): Promise<AddFarmerAssetResult> {
    const now = new Date().toISOString();
    const a: FarmerAsset = {
      id: crypto.randomUUID(),
      farmer_id: row.farmer_id,
      category: row.category,
      sub_category: row.sub_category ?? null,
      product_detail: row.product_detail ?? null,
      quantity: row.quantity ?? null,
      unit: row.unit ?? null,
      area_hectares: row.area_hectares ?? null,
      acquired_date: row.acquired_date || null,
      notes: row.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase.from("farmer_assets").insert(a);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) => [...prev, a]);
    return { ok: true, asset: a };
  }

  async function updateFarmerAsset(
    id: string,
    patch: Partial<{
      category: FarmerAssetCategory;
      sub_category: string | null;
      product_detail: string | null;
      quantity: number | null;
      unit: string | null;
      area_hectares: number | null;
      acquired_date: string | null;
      notes: string | null;
    }>,
  ): Promise<MutationResult> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("farmer_assets")
      .update({ ...patch, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updated_at: now } : x)),
    );
    return { ok: true };
  }

  async function deleteFarmerAsset(id: string): Promise<MutationResult> {
    const { error } = await supabase.from("farmer_assets").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) => prev.filter((x) => x.id !== id));
    return { ok: true };
  }

  /* ── Records CRUD ─────────────────────────────────────────────── */

  async function addRecord(data: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">): Promise<AddRecordResult> {
    const ff = computeFarmerFields(data.farmer_ids || [], farmersRef.current);
    const now = new Date().toISOString();
    const newRecord: AgriRecord = {
      ...data,
      ...ff,
      farmer_ids: data.farmer_ids || [],
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    } as AgriRecord;
    newRecord.commodity_group = newRecord.commodity_group ?? commodityGroupForCommodity(newRecord.commodity);
    const allocationCheck = validateHouseholdCropAllocation({
      record: newRecord,
      households: householdsRef.current,
      records: recordsRef.current,
      farmers: farmersRef.current,
    });
    if (!allocationCheck.ok) return { ok: false, message: allocationCheck.message };
    const { error } = await supabase.from("agri_records").insert(agriRecordInsertRow(newRecord));
    if (error) return { ok: false, message: friendlyDbError(error) };
    setRecords((prev) => [...prev, newRecord]);
    return { ok: true };
  }

  async function updateRecord(id: string, data: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">): Promise<MutationResult> {
    const ff = computeFarmerFields(data.farmer_ids || [], farmersRef.current);
    const now = new Date().toISOString();
    const payload = { ...data, ...ff, farmer_ids: data.farmer_ids || [] };
    const existing = recordsRef.current.find((r) => r.id === id);
    const merged = ({ ...(existing ?? {}), ...payload, id, updated_at: now } as AgriRecord);
    merged.commodity_group = merged.commodity_group ?? commodityGroupForCommodity(merged.commodity);
    const allocationCheck = validateHouseholdCropAllocation({
      record: merged,
      households: householdsRef.current,
      records: recordsRef.current,
      farmers: farmersRef.current,
      excludeRecordId: id,
    });
    if (!allocationCheck.ok) return { ok: false, message: allocationCheck.message };
    const { error } = await supabase
      .from("agri_records")
      .update(agriRecordInsertRow(merged))
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload, updated_at: now } : r)));
    return { ok: true };
  }

  async function deleteRecord(id: string) {
    const { error } = await supabase.from("agri_records").delete().eq("id", id);
    if (error) {
      console.error("[AgriData] deleteRecord:", error.message);
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  /* ── Households CRUD ──────────────────────────────────────────── */

  async function insertHouseholdRow(
    h: Omit<Household, "id" | "created_at" | "updated_at">,
  ): Promise<{ ok: true; row: Household } | { ok: false; message: string }> {
    const now = new Date().toISOString();
    const row: Household = { ...h, id: crypto.randomUUID(), created_at: now, updated_at: now } as Household;
    const { error } = await supabase.from("households").insert(row);
    if (error) return { ok: false, message: error.message };
    setHouseholds((prev) => [...prev, row]);
    return { ok: true, row };
  }

  async function addHousehold(h: Omit<Household, "id" | "created_at" | "updated_at">) {
    const r = await insertHouseholdRow(h);
    return r.ok ? r.row : null;
  }

  async function updateHousehold(id: string, h: Partial<Omit<Household, "id" | "created_at" | "updated_at">>): Promise<MutationResult> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("households")
      .update({ ...h, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    setHouseholds((prev) => prev.map((x) => (x.id === id ? { ...x, ...h, updated_at: now } : x)));
    return { ok: true };
  }

  async function deleteHousehold(id: string) {
    const { error } = await supabase.from("households").delete().eq("id", id);
    if (error) {
      console.error("[AgriData] deleteHousehold:", error.message);
      return;
    }
    // DB cascades subsidies and nulls farmers.household_id; mirror locally.
    setHouseholds((prev) => prev.filter((x) => x.id !== id));
    setHouseholdSubsidies((prev) => prev.filter((s) => s.household_id !== id));
    setFarmers((prev) => prev.map((f) => (f.household_id === id ? { ...f, household_id: null } : f)));
  }

  /* ── Organizations CRUD ───────────────────────────────────────── */

  async function addOrganization(o: Omit<Organization, "id" | "created_at" | "updated_at">): Promise<AddOrganizationResult> {
    const now = new Date().toISOString();
    const org: Organization = { ...o, id: crypto.randomUUID(), created_at: now, updated_at: now } as Organization;
    const { error } = await supabase.from("organizations").insert(org);
    if (error) return { ok: false, message: error.message };
    setOrganizations((prev) => [...prev, org]);
    return { ok: true, organization: org };
  }

  async function updateOrganization(id: string, o: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("organizations")
      .update({ ...o, updated_at: now })
      .eq("id", id);
    if (error) {
      console.error("[AgriData] updateOrganization:", error.message);
      return;
    }
    setOrganizations((prev) => prev.map((x) => (x.id === id ? { ...x, ...o, updated_at: now } : x)));
  }

  async function deleteOrganization(id: string): Promise<MutationResult> {
    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    // DB cascades farmer_organizations and nulls households.organization_id; mirror locally.
    setOrganizations((prev) => prev.filter((x) => x.id !== id));
    setFarmerOrganizations((prev) => prev.filter((r) => r.organization_id !== id));
    setHouseholds((prev) => prev.map((h) => (h.organization_id === id ? { ...h, organization_id: null } : h)));
    return { ok: true };
  }

  /* ── Farmer-Organizations ─────────────────────────────────────── */

  async function saveFarmerOrganizations(farmerId: string, organizationIds: string[]): Promise<MutationResult> {
    const { error: delErr } = await supabase
      .from("farmer_organizations")
      .delete()
      .eq("farmer_id", farmerId);
    if (delErr) return { ok: false, message: delErr.message };
    if (organizationIds.length > 0) {
      const rows = organizationIds.map((organization_id) => ({ farmer_id: farmerId, organization_id }));
      const { error: insErr } = await supabase.from("farmer_organizations").insert(rows);
      if (insErr) return { ok: false, message: insErr.message };
    }
    setFarmerOrganizations((prev) => {
      const rest = prev.filter((r) => r.farmer_id !== farmerId);
      return [...rest, ...organizationIds.map((organization_id) => ({ farmer_id: farmerId, organization_id }))];
    });
    return { ok: true };
  }

  /* ── Farmer helpers ───────────────────────────────────────────── */

  async function demoteOtherHouseholdHeads(householdId: string, exceptFarmerId: string) {
    const { error } = await supabase
      .from("farmers")
      .update({ is_household_head: false })
      .eq("household_id", householdId)
      .neq("id", exceptFarmerId);
    if (error) {
      console.error("[AgriData] demoteOtherHouseholdHeads:", error.message);
      return;
    }
    setFarmers((prev) =>
      prev.map((f) =>
        f.household_id === householdId && f.id !== exceptFarmerId ? { ...f, is_household_head: false } : f,
      ),
    );
  }

  /* ── Farmers CRUD ─────────────────────────────────────────────── */

  async function addFarmer(raw: AddFarmerInput): Promise<AddFarmerResult> {
    const { new_household_display_name, ...data } = raw;
    let payload = { ...data };
    if (!payload.household_id) {
      const displayName =
        (typeof new_household_display_name === "string" && new_household_display_name.trim()) ||
        `Household — ${data.name}`;
      const hh = await insertHouseholdRow({
        barangay: data.barangay,
        display_name: displayName,
        farming_area_hectares: 0,
        rffa_subsidies_notes: "",
        organization_id: null,
      });
      if (!hh.ok) {
        return { ok: false, message: hh.message };
      }
      payload = { ...payload, household_id: hh.row.id, is_household_head: true };
    }

    const now = new Date().toISOString();
    const row: Farmer = normalizeFarmer({
      id: crypto.randomUUID(),
      name: payload.name,
      gender: payload.gender,
      barangay: payload.barangay,
      household_id: payload.household_id,
      is_household_head: payload.is_household_head,
      rsbsa_number: payload.rsbsa_number,
      birth_date: payload.birth_date,
      civil_status: payload.civil_status,
      photo_url: payload.photo_url,
      created_at: now,
      updated_at: now,
    });
    const { error } = await supabase.from("farmers").insert(farmerInsertRow(row));
    if (error) return { ok: false, message: friendlyDbError(error) };
    setFarmers((prev) => [...prev, row]);
    if (row.household_id && row.is_household_head) {
      await demoteOtherHouseholdHeads(row.household_id, row.id);
    }
    return { ok: true, id: row.id };
  }

  async function updateFarmer(id: string, data: Omit<Farmer, "id" | "created_at" | "updated_at">): Promise<MutationResult> {
    const iso = new Date().toISOString();
    const { error } = await supabase
      .from("farmers")
      .update({ ...data, updated_at: iso })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };

    const updatedFarmers = farmersRef.current.map((f) =>
      f.id === id ? { ...f, ...data, updated_at: iso } : f,
    );
    setFarmers(updatedFarmers);

    if (data.household_id && data.is_household_head) {
      await demoteOtherHouseholdHeads(data.household_id, id);
    }

    // Recompute denormalized farmer fields on linked records and persist.
    const affected = recordsRef.current.filter((r) => r.farmer_ids?.includes(id));
    for (const rec of affected) {
      const ff = computeFarmerFields(rec.farmer_ids, updatedFarmers);
      const { error: recErr } = await supabase
        .from("agri_records")
        .update(ff)
        .eq("id", rec.id);
      if (recErr) console.error("[AgriData] updateFarmer record sync:", recErr.message);
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.farmer_ids?.includes(id) ? { ...r, ...computeFarmerFields(r.farmer_ids, updatedFarmers) } : r,
      ),
    );
    return { ok: true };
  }

  async function deleteFarmer(id: string) {
    const { error } = await supabase.from("farmers").delete().eq("id", id);
    if (error) {
      console.error("[AgriData] deleteFarmer:", error.message);
      return;
    }
    const remaining = farmersRef.current.filter((f) => f.id !== id);

    // DB cascades farmer_organizations rows for this farmer.
    // Update agri_records.farmer_ids manually (TEXT[] — no FK).
    const affected = recordsRef.current.filter((r) => r.farmer_ids?.includes(id));
    for (const rec of affected) {
      const newIds = rec.farmer_ids.filter((fid) => fid !== id);
      const ff = computeFarmerFields(newIds, remaining);
      const { error: recErr } = await supabase
        .from("agri_records")
        .update({ farmer_ids: newIds, ...ff })
        .eq("id", rec.id);
      if (recErr) console.error("[AgriData] deleteFarmer record sync:", recErr.message);
    }

    setFarmers(remaining);
    setFarmerOrganizations((prev) => prev.filter((r) => r.farmer_id !== id));
    setFarmerAssets((prev) => prev.filter((a) => a.farmer_id !== id));
    setRecords((prev) =>
      prev.map((r) => {
        if (r.farmer_ids?.includes(id)) {
          const newIds = r.farmer_ids.filter((fid) => fid !== id);
          return { ...r, farmer_ids: newIds, ...computeFarmerFields(newIds, remaining) };
        }
        return r;
      }),
    );
  }

  const getFarmersByIds = useCallback((ids: string[]) => farmers.filter((f) => ids.includes(f.id)), [farmers]);

  /* ── Computed / memoised values ────────────────────────────────── */

  function getProductionValue(r: AgriRecord): number {
    // Backward-compatible hook for legacy callers.
    // Crop KPI is bag/ton; fishery/livestock are separate units.
    if (recordGroup(r as any) === "FISHERY") return numField(r.harvesting_fishery);
    if (recordGroup(r as any) === "LIVESTOCK") return numField(r.livestock_output_heads);
    return numField(r.harvesting_output_bags);
  }

  // Metric memos were moved to lib/contexts/metrics-context.tsx (Phase 5 step A).
  // AgriDataProvider only owns raw state + mutations now; derivations live in MetricsProvider.

  // Phase 5 / refactor: split the legacy single context into three
  // domain-specific contexts (Farmers, Programs, Records) plus Metrics.
  // Each new context exposes only its slice so consumers can subscribe
  // narrowly via `useFarmers()` / `usePrograms()` / `useRecords()`.
  const farmersValue: FarmersContextValue = {
    farmers: vf,
    farmerOrganizations,
    addFarmer,
    updateFarmer,
    deleteFarmer,
    getFarmersByIds,
    getOrganizationIdsForFarmer,
    saveFarmerOrganizations,
    farmerAssets: vAssets,
    getAssetsForFarmer,
    addFarmerAsset,
    updateFarmerAsset,
    deleteFarmerAsset,
  };

  const programsValue: ProgramsContextValue = {
    households: vh,
    organizations: vo,
    getHousehold,
    addHousehold,
    updateHousehold,
    deleteHousehold,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    householdSubsidies: vSubs,
    getSubsidiesForHousehold,
    addHouseholdSubsidy,
    updateHouseholdSubsidy,
    deleteHouseholdSubsidy,
  };

  const recordsValue: RecordsContextValue = {
    records: vr,
    addRecord,
    updateRecord,
    deleteRecord,
  };

  return (
    <FarmersProvider value={farmersValue}>
      <ProgramsProvider value={programsValue}>
        <RecordsProvider value={recordsValue}>
          <MetricsProvider>{children}</MetricsProvider>
        </RecordsProvider>
      </ProgramsProvider>
    </FarmersProvider>
  );
}

/**
 * Legacy facade. Returns the merged shape of all four split contexts so
 * existing components using `useAgriData()` keep working unchanged.
 *
 * New components should prefer the narrow hooks:
 *   - `useFarmers()`   — farmer registry + assets + org links
 *   - `usePrograms()`  — households + organizations + subsidies
 *   - `useRecords()`   — agri_records + record mutations
 *   - `useMetrics()`   — all derived summaries / KPIs
 *
 * The narrow hooks re-render only when their slice changes, so prefer them
 * once you've migrated a component.
 */
export function useAgriData():
  & FarmersContextValue
  & ProgramsContextValue
  & RecordsContextValue
  & MetricsContextValue {
  const farmers = useContext(FarmersContext);
  const programs = useContext(ProgramsContext);
  const records = useContext(RecordsContext);
  const metrics = useContext(MetricsContext);
  if (!farmers) throw new Error("useAgriData must be used within AgriDataProvider (FarmersProvider missing)");
  if (!programs) throw new Error("useAgriData must be used within AgriDataProvider (ProgramsProvider missing)");
  if (!records) throw new Error("useAgriData must be used within AgriDataProvider (RecordsProvider missing)");
  if (!metrics) throw new Error("useAgriData must be used within AgriDataProvider (MetricsProvider missing)");
  return useMemo(
    () => ({ ...farmers, ...programs, ...records, ...metrics }),
    [farmers, programs, records, metrics],
  );
}
