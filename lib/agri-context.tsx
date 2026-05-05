"use client";
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import {
  isSubsidyCategory,
  isFarmerAssetCategory,
  type AgriRecord,
  type Farmer,
  type FarmerAsset,
  type FarmerAssetCategory,
  type Household,
  type HouseholdSubsidy,
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
  productionOutputForRecord,
} from "./data";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase/client";

/**
 * Translate raw Supabase / Postgres errors into user-friendly messages.
 * Most importantly converts CHECK constraint violations (code 23514) — which
 * surface as "new row for relation … violates check constraint …" — into a
 * sentence an LGU encoder can act on. Other errors fall back to the raw
 * message so we never silently lose information.
 */
function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23514") {
    const msg = error.message;
    if (msg.includes("planting_area_sane")) return "Planting area is out of range — must be 0–10,000 ha.";
    if (msg.includes("harvest_bags_sane")) return "Harvest output is out of range — must be 0–1,000,000 bags.";
    if (msg.includes("pests_damage_sane") || msg.includes("calamity_damage_sane"))
      return "Damage area is out of range — must be 0–10,000 ha.";
    if (msg.includes("stocking_sane") || msg.includes("fishery_harvest_sane"))
      return "Fishery value is out of range — must be 0–1,000,000.";
    if (msg.includes("total_farmers_sane")) return "Farmer count is out of range — must be 0–10,000.";
    if (msg.includes("period_month_valid")) return "Reporting month must be between 1 and 12.";
    if (msg.includes("period_year_valid")) return "Reporting year must be between 2020 and 2100.";
    return "One of the values failed a sanity check — please verify and try again.";
  }
  if (error.code === "23505") return "That record already exists (duplicate value).";
  if (error.code === "23503") return "Referenced record was not found — please refresh and retry.";
  if (error.code === "23502") return "A required field was missing.";
  return error.message;
}

export type AddFarmerResult = { ok: true; id: string } | { ok: false; message: string };
/** Optional display name when creating a new household from the farmer form (not stored on farmers row). */
export type AddFarmerInput = Omit<Farmer, "id" | "created_at" | "updated_at"> & {
  new_household_display_name?: string | null;
};
export type AddRecordResult = { ok: true } | { ok: false; message: string };
export type MutationResult = { ok: true } | { ok: false; message: string };
export type AddOrganizationResult =
  | { ok: true; organization: Organization }
  | { ok: false; message: string };
export type AddHouseholdSubsidyResult =
  | { ok: true; subsidy: HouseholdSubsidy }
  | { ok: false; message: string };
export type AddFarmerAssetResult =
  | { ok: true; asset: FarmerAsset }
  | { ok: false; message: string };

/* ── Supabase insert-row builders ─────────────────────────────────── */
/** Columns on public.farmers (matches scripts/seed-supabase-bulk.ts). */
function farmerInsertRow(f: Farmer) {
  return {
    id: f.id,
    name: f.name,
    gender: f.gender,
    barangay: f.barangay,
    household_id: f.household_id,
    is_household_head: f.is_household_head,
    rsbsa_number: f.rsbsa_number,
    birth_date: f.birth_date,
    civil_status: f.civil_status,
    photo_url: f.photo_url,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

/** Columns on public.agri_records (period_month/year added via migration 007). */
function agriRecordInsertRow(r: AgriRecord) {
  return {
    id: r.id,
    barangay: r.barangay,
    commodity: r.commodity,
    sub_category: r.sub_category,
    farmer_ids: r.farmer_ids,
    farmer_names: r.farmer_names,
    farmer_male: r.farmer_male,
    farmer_female: r.farmer_female,
    total_farmers: r.total_farmers,
    planting_area_hectares: r.planting_area_hectares,
    harvesting_output_bags: r.harvesting_output_bags,
    damage_pests_hectares: r.damage_pests_hectares,
    damage_calamity_hectares: r.damage_calamity_hectares,
    stocking: r.stocking,
    harvesting_fishery: r.harvesting_fishery,
    pests_diseases: r.pests_diseases,
    calamity: r.calamity,
    calamity_sub_category: r.calamity_sub_category,
    remarks: r.remarks,
    period_month: r.period_month,
    period_year: r.period_year,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/* ── context type ─────────────────────────────────────────────────── */

type AgriContextValue = {
  records: AgriRecord[];
  addRecord: (
    record: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">,
  ) => Promise<AddRecordResult>;
  updateRecord: (
    id: string,
    record: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">,
  ) => Promise<MutationResult>;
  deleteRecord: (id: string) => void;
  farmers: Farmer[];
  addFarmer: (farmer: AddFarmerInput) => Promise<AddFarmerResult>;
  updateFarmer: (id: string, farmer: Omit<Farmer, "id" | "created_at" | "updated_at">) => Promise<MutationResult>;
  deleteFarmer: (id: string) => Promise<void>;
  getFarmersByIds: (ids: string[]) => Farmer[];
  farmersByBarangay: Record<string, Farmer[]>;
  households: Household[];
  organizations: Organization[];
  farmerOrganizations: FarmerOrganizationRow[];
  getHousehold: (id: string | null) => Household | undefined;
  addHousehold: (h: Omit<Household, "id" | "created_at" | "updated_at">) => Promise<Household | null>;
  updateHousehold: (id: string, h: Partial<Omit<Household, "id" | "created_at" | "updated_at">>) => Promise<MutationResult>;
  deleteHousehold: (id: string) => Promise<void>;
  addOrganization: (o: Omit<Organization, "id" | "created_at" | "updated_at">) => Promise<AddOrganizationResult>;
  updateOrganization: (id: string, o: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>) => Promise<void>;
  deleteOrganization: (id: string) => Promise<MutationResult>;
  saveFarmerOrganizations: (farmerId: string, organizationIds: string[]) => Promise<MutationResult>;
  householdSubsidies: HouseholdSubsidy[];
  getSubsidiesForHousehold: (householdId: string) => HouseholdSubsidy[];
  addHouseholdSubsidy: (row: {
    household_id: string;
    category: SubsidyCategory;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    amount_php?: number | null;
    program_source?: string | null;
    received_date?: string | null;
    notes?: string | null;
  }) => Promise<AddHouseholdSubsidyResult>;
  updateHouseholdSubsidy: (
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
  ) => Promise<MutationResult>;
  deleteHouseholdSubsidy: (id: string) => Promise<MutationResult>;
  farmerAssets: FarmerAsset[];
  getAssetsForFarmer: (farmerId: string) => FarmerAsset[];
  addFarmerAsset: (row: {
    farmer_id: string;
    category: FarmerAssetCategory;
    sub_category?: string | null;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    area_hectares?: number | null;
    acquired_date?: string | null;
    notes?: string | null;
  }) => Promise<AddFarmerAssetResult>;
  updateFarmerAsset: (
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
  ) => Promise<MutationResult>;
  deleteFarmerAsset: (id: string) => Promise<MutationResult>;
  getOrganizationIdsForFarmer: (farmerId: string) => string[];
  organizationStats: { id: string; name: string; org_type: OrgType; memberCount: number }[];
  uniqueFarmersInOrganizations: number;
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

const validBarangays = new Set<string>(BARANGAYS);

function normalizeHouseholdSubsidy(row: Record<string, unknown>): HouseholdSubsidy {
  const catRaw = String(row.category ?? "other");
  const category: SubsidyCategory = isSubsidyCategory(catRaw) ? catRaw : "other";
  return {
    id: String(row.id),
    household_id: String(row.household_id ?? ""),
    category,
    product_detail: row.product_detail != null ? String(row.product_detail) : null,
    quantity: row.quantity != null && row.quantity !== "" ? Number(row.quantity) : null,
    unit: row.unit != null ? String(row.unit) : null,
    amount_php: row.amount_php != null && row.amount_php !== "" ? Number(row.amount_php) : null,
    program_source: row.program_source != null ? String(row.program_source) : null,
    received_date: row.received_date != null ? String(row.received_date).slice(0, 10) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeFarmerAsset(row: Record<string, unknown>): FarmerAsset {
  const catRaw = String(row.category ?? "planting_area");
  const category: FarmerAssetCategory = isFarmerAssetCategory(catRaw) ? catRaw : "planting_area";
  return {
    id: String(row.id),
    farmer_id: String(row.farmer_id ?? ""),
    category,
    sub_category: row.sub_category != null ? String(row.sub_category) : null,
    product_detail: row.product_detail != null ? String(row.product_detail) : null,
    quantity: row.quantity != null && row.quantity !== "" ? Number(row.quantity) : null,
    unit: row.unit != null ? String(row.unit) : null,
    area_hectares: row.area_hectares != null && row.area_hectares !== "" ? Number(row.area_hectares) : null,
    acquired_date: row.acquired_date != null ? String(row.acquired_date).slice(0, 10) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeFarmer(row: Record<string, unknown>): Farmer {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    gender: (row.gender === "Female" ? "Female" : "Male") as Farmer["gender"],
    barangay: String(row.barangay ?? ""),
    household_id: row.household_id != null ? String(row.household_id) : null,
    is_household_head: row.is_household_head === true,
    rsbsa_number: row.rsbsa_number != null ? String(row.rsbsa_number) : null,
    birth_date: row.birth_date != null ? String(row.birth_date).slice(0, 10) : null,
    civil_status: row.civil_status != null ? String(row.civil_status) : null,
    photo_url: row.photo_url != null ? String(row.photo_url) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeAgriRecord(row: Record<string, unknown>): AgriRecord {
  const r = row as unknown as AgriRecord;
  const sub = typeof r.sub_category === "string" ? r.sub_category : String(r.sub_category ?? "");
  return {
    ...r,
    commodity: normalizeCommodity(r.commodity, sub),
    farmer_ids: Array.isArray(r.farmer_ids) ? (r.farmer_ids as string[]) : [],
    calamity_sub_category: normalizeCalamitySubCategory(row.calamity_sub_category),
    planting_area_hectares: numField(r.planting_area_hectares),
    harvesting_output_bags: numField(r.harvesting_output_bags),
    damage_pests_hectares: numField(r.damage_pests_hectares),
    damage_calamity_hectares: numField(r.damage_calamity_hectares),
    stocking: numField(r.stocking),
    harvesting_fishery: numField(r.harvesting_fishery),
    farmer_male: numField(r.farmer_male),
    farmer_female: numField(r.farmer_female),
    total_farmers: numField(r.total_farmers),
  };
}

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
  const vf = useMemo(
    () => (isBarangayUser && userBarangay ? farmers.filter((f) => f.barangay === userBarangay) : farmers),
    [farmers, isBarangayUser, userBarangay],
  );

  const vh = useMemo(
    () => (isBarangayUser && userBarangay ? households.filter((h) => h.barangay === userBarangay) : households),
    [households, isBarangayUser, userBarangay],
  );

  const vo = useMemo(() => {
    if (isBarangayUser && userBarangay) {
      return organizations.filter((o) => !o.barangay || o.barangay === userBarangay);
    }
    return organizations;
  }, [organizations, isBarangayUser, userBarangay]);

  const vSubs = useMemo(() => {
    const hid = new Set(vh.map((h) => h.id));
    return householdSubsidies.filter((s) => hid.has(s.household_id));
  }, [householdSubsidies, vh]);

  const vAssets = useMemo(() => {
    const fid = new Set(vf.map((f) => f.id));
    return farmerAssets.filter((a) => fid.has(a.farmer_id));
  }, [farmerAssets, vf]);

  const vfIds = useMemo(() => new Set(vf.map((f) => f.id)), [vf]);

  const organizationStats = useMemo(() => {
    const counts = new Map<string, number>();
    farmerOrganizations.forEach(({ farmer_id, organization_id }) => {
      if (vfIds.has(farmer_id)) {
        counts.set(organization_id, (counts.get(organization_id) || 0) + 1);
      }
    });
    return vo.map((org) => ({
      id: org.id,
      name: org.name,
      org_type: org.org_type,
      memberCount: counts.get(org.id) || 0,
    }));
  }, [farmerOrganizations, vfIds, vo]);

  const uniqueFarmersInOrganizations = useMemo(() => {
    const ids = new Set<string>();
    farmerOrganizations.forEach(({ farmer_id }) => {
      if (vfIds.has(farmer_id)) ids.add(farmer_id);
    });
    return ids.size;
  }, [farmerOrganizations, vfIds]);

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
    return productionOutputForRecord(r);
  }

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
    const bags = vr.reduce((s, r) => s + getProductionValue(r), 0);
    return { bags, tons: +(bags * 0.04).toFixed(2) };
  }, [vr]);

  const totalPlantingArea = useMemo(() => +vr.reduce((s, r) => s + r.planting_area_hectares, 0).toFixed(2), [vr]);
  const totalDamagedArea = useMemo(
    () => +vr.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0).toFixed(2),
    [vr],
  );

  const mostProducedCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + getProductionValue(r); });
    const sorted = Object.entries(t).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "N/A";
  }, [vr]);

  const productionByCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + getProductionValue(r); });
    return Object.entries(t).map(([name, bags]) => ({ name, bags, tons: +(bags * 0.04).toFixed(2) }));
  }, [vr]);

  const productionBySubCategory = useMemo(() => {
    const t: Record<string, { commodity: string; bags: number }> = {};
    vr.forEach((r) => {
      if (!t[r.sub_category]) t[r.sub_category] = { commodity: r.commodity, bags: 0 };
      t[r.sub_category].bags += getProductionValue(r);
    });
    return Object.entries(t).map(([name, v]) => ({ name, ...v, tons: +(v.bags * 0.04).toFixed(2) }));
  }, [vr]);

  const farmersByCommodity = useMemo(() => {
    const t: Record<string, { male: number; female: number; total: number }> = {};
    vr.forEach((r) => {
      if (!t[r.commodity]) t[r.commodity] = { male: 0, female: 0, total: 0 };
      t[r.commodity].male += r.farmer_male;
      t[r.commodity].female += r.farmer_female;
      t[r.commodity].total += r.total_farmers;
    });
    return Object.entries(t).map(([name, v]) => ({ name, ...v }));
  }, [vr]);

  const damageRiskData = useMemo(
    () =>
      vr
        .filter(
          (r) =>
            r.damage_pests_hectares > 0 ||
            r.damage_calamity_hectares > 0 ||
            r.pests_diseases !== "None" ||
            r.calamity !== "None" ||
            r.calamity_sub_category !== "None",
        )
        .sort(
          (a, b) =>
            b.damage_pests_hectares + b.damage_calamity_hectares - (a.damage_pests_hectares + a.damage_calamity_hectares),
        ),
    [vr],
  );

  const damageByCommodity = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.commodity] = (t[r.commodity] || 0) + r.damage_pests_hectares + r.damage_calamity_hectares; });
    return Object.entries(t)
      .map(([name, area]) => ({ name, area: +area.toFixed(2) }))
      .sort((a, b) => b.area - a.area);
  }, [vr]);

  const damageByBarangay = useMemo(() => {
    const t: Record<string, number> = {};
    vr.forEach((r) => { t[r.barangay] = (t[r.barangay] || 0) + r.damage_pests_hectares + r.damage_calamity_hectares; });
    return t;
  }, [vr]);

  const mostAffectedBarangay = useMemo(() => {
    const entries = Object.entries(damageByBarangay);
    if (entries.length === 0) return "None";
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return max[1] > 0 ? max[0] : "None";
  }, [damageByBarangay]);

  const damagePercentage = useMemo(
    () => (totalPlantingArea > 0 ? +((totalDamagedArea / totalPlantingArea) * 100).toFixed(1) : 0),
    [totalDamagedArea, totalPlantingArea],
  );

  const affectedFarmerCount = useMemo(
    () => vr.filter((r) => r.damage_pests_hectares > 0 || r.damage_calamity_hectares > 0).reduce((s, r) => s + r.total_farmers, 0),
    [vr],
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
    vr.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      if (!map[day]) map[day] = [];
      map[day].push(r);
    });
    return map;
  }, [vr]);

  const [staleTimestamp, setStaleTimestamp] = useState(() => Date.now());
  useEffect(() => { setStaleTimestamp(Date.now()); }, [records]);

  const staleBarangays = useMemo(() => {
    return BARANGAYS.map((name) => {
      const br = records.filter((r) => r.barangay === name);
      if (br.length === 0) return { name, daysSinceUpdate: null, lastUpdate: null };
      const latest = br.reduce((max, r) => (r.created_at > max ? r.created_at : max), "");
      return {
        name,
        daysSinceUpdate: Math.floor((staleTimestamp - new Date(latest).getTime()) / 86400000),
        lastUpdate: latest.slice(0, 10),
      };
    });
  }, [records, staleTimestamp]);

  const value: AgriContextValue = {
    records: vr,
    addRecord,
    updateRecord,
    deleteRecord,
    farmers: vf,
    addFarmer,
    updateFarmer,
    deleteFarmer,
    getFarmersByIds,
    farmersByBarangay,
    households: vh,
    organizations: vo,
    farmerOrganizations,
    getHousehold,
    addHousehold,
    updateHousehold,
    deleteHousehold,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    saveFarmerOrganizations,
    householdSubsidies: vSubs,
    getSubsidiesForHousehold,
    addHouseholdSubsidy,
    updateHouseholdSubsidy,
    deleteHouseholdSubsidy,
    farmerAssets: vAssets,
    getAssetsForFarmer,
    addFarmerAsset,
    updateFarmerAsset,
    deleteFarmerAsset,
    getOrganizationIdsForFarmer,
    organizationStats,
    uniqueFarmersInOrganizations,
    totalFarmers,
    totalProduction,
    totalPlantingArea,
    totalDamagedArea,
    mostProducedCommodity,
    productionByCommodity,
    productionBySubCategory,
    farmersByCommodity,
    damageRiskData,
    damageByCommodity,
    damageByBarangay,
    mostAffectedBarangay,
    damagePercentage,
    affectedFarmerCount,
    damageTrend,
    recordsByDate,
    staleBarangays,
  };

  return <AgriContext.Provider value={value}>{children}</AgriContext.Provider>;
}

export function useAgriData() {
  const ctx = useContext(AgriContext);
  if (!ctx) throw new Error("useAgriData must be used within AgriDataProvider");
  return ctx;
}
