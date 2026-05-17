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
import { validateDomainRecord, formatDomainIssues } from "@/lib/domain/validation";
import {
  validateHouseholdCropAllocation,
  validateLandAssetAllocation,
  type HouseholdAllocationValidation,
  type LandAssetAllocationValidation,
} from "@/lib/domain/allocation";
import {
  AGRI_RECORD_LOGGED_FIELDS,
  FARMER_ASSET_LOGGED_FIELDS,
  FARMER_LOGGED_FIELDS,
  HOUSEHOLD_LOGGED_FIELDS,
  HOUSEHOLD_SUBSIDY_LOGGED_FIELDS,
  ORGANIZATION_LOGGED_FIELDS,
  pickChangedFields,
  pickFields,
  resolveAgriRecordUpdateAction,
  resolveFarmerUpdateAction,
  summarizeAgriRecordChange,
  summarizeFarmerAssetChange,
  summarizeFarmerChange,
  summarizeHouseholdChange,
  summarizeHouseholdSubsidyChange,
  summarizeOrgMembershipChange,
  summarizeOrganizationChange,
} from "@/lib/domain/activity";
import { logActivity, type ActivityActor } from "@/lib/activity-log";
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
  const { isBarangayUser, userBarangay, isLoggedIn, user } = useAuth();
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

  const farmerAssetsRef = useRef<FarmerAsset[]>(farmerAssets);
  useEffect(() => { farmerAssetsRef.current = farmerAssets; }, [farmerAssets]);

  // Activity-log actor snapshot. Captured at mutation time so logs survive
  // later profile edits / deletes. Pulls from useAuth() via a ref so we don't
  // re-create mutation closures on every auth refresh.
  const actorRef = useRef<ActivityActor>({ id: null, name: null, role: null });
  useEffect(() => {
    actorRef.current = {
      id: user?.id ?? null,
      name: user?.displayName?.trim() || user?.username || null,
      role: user?.role ?? null,
    };
  }, [user]);

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
        // Phase 6 (migration 020): four core tables are soft-deletable. The
        // provider's contract is "live rows only" — admin restore page (and
        // any future audit view) fetches deleted rows directly.
        const [recordsRes, farmersRes, householdsRes, orgsRes, farmerOrgsRes, subsRes, assetsRes] = await Promise.all([
          supabase.from("agri_records").select("*").is("deleted_at", null),
          supabase.from("farmers").select("*").is("deleted_at", null),
          supabase.from("households").select("*").is("deleted_at", null),
          supabase.from("organizations").select("*"),
          supabase.from("farmer_organizations").select("*"),
          supabase.from("household_subsidies").select("*"),
          supabase.from("farmer_assets").select("*").is("deleted_at", null),
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
    // Subsidies have no barangay column — inherit from the owning household.
    const householdBarangay =
      householdsRef.current.find((h) => h.id === s.household_id)?.barangay ?? "";
    if (householdBarangay) {
      void logActivity({
        entityType: "household_subsidy",
        entityId: s.id,
        action: "subsidy_added",
        barangay: householdBarangay,
        before: null,
        after: pickFields(s, HOUSEHOLD_SUBSIDY_LOGGED_FIELDS),
        summary: summarizeHouseholdSubsidyChange("subsidy_added", null, s),
        actor: actorRef.current,
        metadata: { household_id: s.household_id },
      });
    }
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
    const existing = householdSubsidies.find((x) => x.id === id);
    const { error } = await supabase
      .from("household_subsidies")
      .update({ ...patch, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setHouseholdSubsidies((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updated_at: now } : x)),
    );
    if (existing) {
      const merged: HouseholdSubsidy = { ...existing, ...patch, updated_at: now } as HouseholdSubsidy;
      const diff = pickChangedFields(existing, merged, HOUSEHOLD_SUBSIDY_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        const householdBarangay =
          householdsRef.current.find((h) => h.id === merged.household_id)?.barangay ?? "";
        if (householdBarangay) {
          void logActivity({
            entityType: "household_subsidy",
            entityId: id,
            action: "subsidy_updated",
            barangay: householdBarangay,
            before: diff.before,
            after: diff.after,
            summary: summarizeHouseholdSubsidyChange("subsidy_updated", existing, merged),
            actor: actorRef.current,
            metadata: { household_id: merged.household_id },
          });
        }
      }
    }
    return { ok: true };
  }

  async function deleteHouseholdSubsidy(id: string): Promise<MutationResult> {
    const existing = householdSubsidies.find((x) => x.id === id);
    const { error } = await supabase.from("household_subsidies").delete().eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setHouseholdSubsidies((prev) => prev.filter((x) => x.id !== id));
    if (existing) {
      const householdBarangay =
        householdsRef.current.find((h) => h.id === existing.household_id)?.barangay ?? "";
      if (householdBarangay) {
        void logActivity({
          entityType: "household_subsidy",
          entityId: id,
          action: "subsidy_removed",
          barangay: householdBarangay,
          before: pickFields(existing, HOUSEHOLD_SUBSIDY_LOGGED_FIELDS),
          after: null,
          summary: summarizeHouseholdSubsidyChange("subsidy_removed", existing, null),
          actor: actorRef.current,
          metadata: { household_id: existing.household_id },
        });
      }
    }
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
    parcel_label?: string | null;
    parcel_code?: string | null;
    centroid_lat?: number | null;
    centroid_lng?: number | null;
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
      parcel_label: row.parcel_label ?? null,
      parcel_code: row.parcel_code ?? null,
      centroid_lat: row.centroid_lat ?? null,
      centroid_lng: row.centroid_lng ?? null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase.from("farmer_assets").insert(a);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) => [...prev, a]);
    // farmer_assets has no barangay column — inherit from the owning farmer.
    const ownerBarangay =
      farmersRef.current.find((f) => f.id === a.farmer_id)?.barangay ?? "";
    if (ownerBarangay) {
      void logActivity({
        entityType: "farmer_asset",
        entityId: a.id,
        action: "created",
        barangay: ownerBarangay,
        before: null,
        after: pickFields(a, FARMER_ASSET_LOGGED_FIELDS),
        summary: summarizeFarmerAssetChange("created", null, a),
        actor: actorRef.current,
        metadata: { farmer_id: a.farmer_id },
      });
    }
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
      parcel_label: string | null;
      parcel_code: string | null;
      centroid_lat: number | null;
      centroid_lng: number | null;
    }>,
  ): Promise<MutationResult> {
    const now = new Date().toISOString();
    const existing = farmerAssetsRef.current.find((x) => x.id === id);
    const { error } = await supabase
      .from("farmer_assets")
      .update({ ...patch, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updated_at: now } : x)),
    );
    if (existing) {
      const merged: FarmerAsset = { ...existing, ...patch, updated_at: now } as FarmerAsset;
      const diff = pickChangedFields(existing, merged, FARMER_ASSET_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        const ownerBarangay =
          farmersRef.current.find((f) => f.id === merged.farmer_id)?.barangay ?? "";
        if (ownerBarangay) {
          void logActivity({
            entityType: "farmer_asset",
            entityId: id,
            action: "updated",
            barangay: ownerBarangay,
            before: diff.before,
            after: diff.after,
            summary: summarizeFarmerAssetChange("updated", existing, merged),
            actor: actorRef.current,
            metadata: { farmer_id: merged.farmer_id },
          });
        }
      }
    }
    return { ok: true };
  }

  async function deleteFarmerAsset(id: string): Promise<MutationResult> {
    const existing = farmerAssetsRef.current.find((x) => x.id === id);
    // Phase 6 (migration 020): soft delete. The row stays in the DB with
    // deleted_at set; the load query filters it out. Restoration is via
    // app/admin/restore.
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("farmer_assets")
      .update({ deleted_at: deletedAt })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    setFarmerAssets((prev) => prev.filter((x) => x.id !== id));
    if (existing) {
      const ownerBarangay =
        farmersRef.current.find((f) => f.id === existing.farmer_id)?.barangay ?? "";
      if (ownerBarangay) {
        void logActivity({
          entityType: "farmer_asset",
          entityId: id,
          action: "deleted",
          barangay: ownerBarangay,
          before: pickFields(existing, FARMER_ASSET_LOGGED_FIELDS),
          after: null,
          summary: summarizeFarmerAssetChange("deleted", existing, null),
          actor: actorRef.current,
          metadata: { farmer_id: existing.farmer_id },
        });
      }
    }
    return { ok: true };
  }

  /* ── Records CRUD ─────────────────────────────────────────────── */

  /**
   * Phase 4 — log an allocation-overflow attempt. Capacity-kind rejections
   * only; structural rejections (no household, owner mismatch, etc.) are
   * intentionally skipped so the audit table stays focused on "users trying
   * to overbook". Fire-and-forget; never blocks the rejected mutation.
   *
   * The attempted record is identified by its in-memory UUID even though no
   * row was written — entity_id has no FK, and a real record with the same
   * UUID can never exist (random v4). For updates the id is the existing
   * row's id, so an investigator can correlate "attempt at 14:02 → eventual
   * successful edit at 14:05".
   */
  function logHouseholdOverflowAttempt(
    rec: AgriRecord,
    reject: Extract<HouseholdAllocationValidation, { ok: false; kind: "capacity" }>,
  ) {
    void logActivity({
      entityType: "agri_record",
      entityId: rec.id,
      action: "allocation_overflow_attempt",
      barangay: rec.barangay,
      before: null,
      after: null,
      summary: reject.message,
      actor: actorRef.current,
      metadata: {
        pool: "household",
        household_id: reject.householdId,
        proposed_ha: reject.proposedHa,
        remaining_ha: reject.remainingHa,
        commodity: rec.commodity,
        sub_category: rec.sub_category,
        period_month: rec.period_month,
        period_year: rec.period_year,
      },
    });
  }

  function logAssetOverflowAttempt(
    rec: AgriRecord,
    reject: Extract<LandAssetAllocationValidation, { ok: false; kind: "capacity" }>,
  ) {
    void logActivity({
      entityType: "agri_record",
      entityId: rec.id,
      action: "allocation_overflow_attempt",
      barangay: rec.barangay,
      before: null,
      after: null,
      summary: reject.message,
      actor: actorRef.current,
      metadata: {
        pool: "asset",
        farmer_asset_id: reject.assetId,
        parcel_label: reject.parcelLabel ?? null,
        proposed_ha: reject.proposedHa,
        remaining_ha: reject.remainingHa,
        total_ha: reject.totalHa,
        commodity: rec.commodity,
        sub_category: rec.sub_category,
        period_month: rec.period_month,
        period_year: rec.period_year,
      },
    });
  }

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
    // Server-side domain enforcement: commodity field isolation + status
    // evidence. Defense-in-depth — the form already runs this, but any caller
    // that bypasses the form (scripts, future API routes) gets the same rules.
    const domainCheck = validateDomainRecord({
      record: newRecord,
      group: newRecord.commodity_group,
      status: newRecord.status ?? undefined,
    });
    if (!domainCheck.ok) {
      return { ok: false, message: formatDomainIssues(domainCheck.issues).message };
    }
    const allocationCheck = validateHouseholdCropAllocation({
      record: newRecord,
      households: householdsRef.current,
      records: recordsRef.current,
      farmers: farmersRef.current,
    });
    if (!allocationCheck.ok) {
      if (allocationCheck.kind === "capacity") logHouseholdOverflowAttempt(newRecord, allocationCheck);
      return { ok: false, message: allocationCheck.message };
    }
    const landCheck = validateLandAssetAllocation({
      record: newRecord,
      farmerAssets: farmerAssetsRef.current,
      records: recordsRef.current,
    });
    if (!landCheck.ok) {
      if (landCheck.kind === "capacity") logAssetOverflowAttempt(newRecord, landCheck);
      return { ok: false, message: landCheck.message };
    }
    const { error } = await supabase.from("agri_records").insert(agriRecordInsertRow(newRecord));
    if (error) return { ok: false, message: friendlyDbError(error) };
    setRecords((prev) => [...prev, newRecord]);
    // Phase Next: activity log — fire-and-forget, never blocks the user's write.
    void logActivity({
      entityType: "agri_record",
      entityId: newRecord.id,
      action: "created",
      barangay: newRecord.barangay,
      before: null,
      after: pickFields(newRecord, AGRI_RECORD_LOGGED_FIELDS),
      summary: summarizeAgriRecordChange("created", null, newRecord),
      actor: actorRef.current,
    });
    return { ok: true };
  }

  async function updateRecord(id: string, data: Omit<AgriRecord, "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female">): Promise<MutationResult> {
    const ff = computeFarmerFields(data.farmer_ids || [], farmersRef.current);
    const now = new Date().toISOString();
    const payload = { ...data, ...ff, farmer_ids: data.farmer_ids || [] };
    const existing = recordsRef.current.find((r) => r.id === id);
    const merged = ({ ...(existing ?? {}), ...payload, id, updated_at: now } as AgriRecord);
    merged.commodity_group = merged.commodity_group ?? commodityGroupForCommodity(merged.commodity);
    // Server-side domain enforcement (see addRecord for rationale).
    const domainCheck = validateDomainRecord({
      record: merged,
      group: merged.commodity_group,
      status: merged.status ?? undefined,
    });
    if (!domainCheck.ok) {
      return { ok: false, message: formatDomainIssues(domainCheck.issues).message };
    }
    const allocationCheck = validateHouseholdCropAllocation({
      record: merged,
      households: householdsRef.current,
      records: recordsRef.current,
      farmers: farmersRef.current,
      excludeRecordId: id,
    });
    if (!allocationCheck.ok) {
      if (allocationCheck.kind === "capacity") logHouseholdOverflowAttempt(merged, allocationCheck);
      return { ok: false, message: allocationCheck.message };
    }
    const landCheck = validateLandAssetAllocation({
      record: merged,
      farmerAssets: farmerAssetsRef.current,
      records: recordsRef.current,
      excludeRecordId: id,
    });
    if (!landCheck.ok) {
      if (landCheck.kind === "capacity") logAssetOverflowAttempt(merged, landCheck);
      return { ok: false, message: landCheck.message };
    }
    const { error } = await supabase
      .from("agri_records")
      .update(agriRecordInsertRow(merged))
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload, updated_at: now } : r)));
    // Phase Next: activity log. Resolve the semantic action from the diff, and
    // skip the log entirely when nothing meaningful changed (the helper
    // short-circuits on an empty diff).
    if (existing) {
      const diff = pickChangedFields(existing, merged, AGRI_RECORD_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        const action = resolveAgriRecordUpdateAction(existing, merged);
        void logActivity({
          entityType: "agri_record",
          entityId: id,
          action,
          barangay: merged.barangay,
          before: diff.before,
          after: diff.after,
          summary: summarizeAgriRecordChange(action, existing, merged),
          actor: actorRef.current,
        });
      }
    }
    return { ok: true };
  }

  async function deleteRecord(id: string) {
    // Snapshot the row BEFORE the delete so we can log its identity.
    const existing = recordsRef.current.find((r) => r.id === id);
    // Phase 6 (migration 020): soft delete. The row stays in the DB; the
    // load query filters it out. Restoration via app/admin/restore.
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("agri_records")
      .update({ deleted_at: deletedAt })
      .eq("id", id);
    if (error) {
      console.error("[AgriData] deleteRecord:", error.message);
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (existing) {
      void logActivity({
        entityType: "agri_record",
        entityId: id,
        action: "deleted",
        barangay: existing.barangay,
        before: pickFields(existing, AGRI_RECORD_LOGGED_FIELDS),
        after: null,
        summary: summarizeAgriRecordChange("deleted", existing, null),
        actor: actorRef.current,
      });
    }
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
    void logActivity({
      entityType: "household",
      entityId: row.id,
      action: "created",
      barangay: row.barangay,
      before: null,
      after: pickFields(row, HOUSEHOLD_LOGGED_FIELDS),
      summary: summarizeHouseholdChange("created", null, row),
      actor: actorRef.current,
    });
    return { ok: true, row };
  }

  async function addHousehold(h: Omit<Household, "id" | "created_at" | "updated_at">) {
    const r = await insertHouseholdRow(h);
    return r.ok ? r.row : null;
  }

  async function updateHousehold(id: string, h: Partial<Omit<Household, "id" | "created_at" | "updated_at">>): Promise<MutationResult> {
    const now = new Date().toISOString();
    const existing = householdsRef.current.find((x) => x.id === id);
    const { error } = await supabase
      .from("households")
      .update({ ...h, updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    setHouseholds((prev) => prev.map((x) => (x.id === id ? { ...x, ...h, updated_at: now } : x)));
    if (existing) {
      const merged: Household = { ...existing, ...h, updated_at: now } as Household;
      const diff = pickChangedFields(existing, merged, HOUSEHOLD_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        void logActivity({
          entityType: "household",
          entityId: id,
          action: "updated",
          barangay: merged.barangay,
          before: diff.before,
          after: diff.after,
          summary: summarizeHouseholdChange("updated", existing, merged),
          actor: actorRef.current,
        });
      }
    }
    return { ok: true };
  }

  async function deleteHousehold(id: string) {
    const existing = householdsRef.current.find((x) => x.id === id);
    const preservedSubsidyCount = householdSubsidies.filter((s) => s.household_id === id).length;
    const preservedFarmerCount = farmersRef.current.filter((f) => f.household_id === id).length;
    // Phase 6 (migration 020): soft delete. Unlike the prior hard-delete path,
    // we do NOT cascade-detach farmers or remove subsidies — those rows stay
    // attached so the household can be restored without re-linking. UI
    // lookups for the soft-deleted household will return undefined; existing
    // `?.field ?? ""` defenses handle that.
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("households")
      .update({ deleted_at: deletedAt })
      .eq("id", id);
    if (error) {
      console.error("[AgriData] deleteHousehold:", error.message);
      return;
    }
    setHouseholds((prev) => prev.filter((x) => x.id !== id));
    if (existing) {
      void logActivity({
        entityType: "household",
        entityId: id,
        action: "deleted",
        barangay: existing.barangay,
        before: pickFields(existing, HOUSEHOLD_LOGGED_FIELDS),
        after: null,
        summary: summarizeHouseholdChange("deleted", existing, null),
        actor: actorRef.current,
        metadata: {
          soft_delete: true,
          deleted_at: deletedAt,
          preserved: {
            household_subsidies_attached: preservedSubsidyCount,
            farmers_attached: preservedFarmerCount,
          },
        },
      });
    }
  }

  /* ── Organizations CRUD ───────────────────────────────────────── */

  async function addOrganization(o: Omit<Organization, "id" | "created_at" | "updated_at">): Promise<AddOrganizationResult> {
    const now = new Date().toISOString();
    const org: Organization = { ...o, id: crypto.randomUUID(), created_at: now, updated_at: now } as Organization;
    const { error } = await supabase.from("organizations").insert(org);
    if (error) return { ok: false, message: error.message };
    setOrganizations((prev) => [...prev, org]);
    // Org barangay is nullable (cross-barangay orgs). Activity log requires
    // NOT NULL so use 'ALL' as a sentinel — admins see those via the role
    // bypass; barangay users do not (consistent with org write being
    // admin-only per migration 004).
    void logActivity({
      entityType: "organization",
      entityId: org.id,
      action: "created",
      barangay: org.barangay ?? "ALL",
      before: null,
      after: pickFields(org, ORGANIZATION_LOGGED_FIELDS),
      summary: summarizeOrganizationChange("created", null, org),
      actor: actorRef.current,
    });
    return { ok: true, organization: org };
  }

  async function updateOrganization(id: string, o: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>) {
    const now = new Date().toISOString();
    const existing = organizations.find((x) => x.id === id);
    const { error } = await supabase
      .from("organizations")
      .update({ ...o, updated_at: now })
      .eq("id", id);
    if (error) {
      console.error("[AgriData] updateOrganization:", error.message);
      return;
    }
    setOrganizations((prev) => prev.map((x) => (x.id === id ? { ...x, ...o, updated_at: now } : x)));
    if (existing) {
      const merged: Organization = { ...existing, ...o, updated_at: now } as Organization;
      const diff = pickChangedFields(existing, merged, ORGANIZATION_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        void logActivity({
          entityType: "organization",
          entityId: id,
          action: "updated",
          barangay: merged.barangay ?? "ALL",
          before: diff.before,
          after: diff.after,
          summary: summarizeOrganizationChange("updated", existing, merged),
          actor: actorRef.current,
        });
      }
    }
  }

  async function deleteOrganization(id: string): Promise<MutationResult> {
    const existing = organizations.find((x) => x.id === id);
    const cascadeMemberCount = farmerOrganizations.filter((r) => r.organization_id === id).length;
    const cascadeHouseholdCount = householdsRef.current.filter((h) => h.organization_id === id).length;
    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    // DB cascades farmer_organizations and nulls households.organization_id; mirror locally.
    setOrganizations((prev) => prev.filter((x) => x.id !== id));
    setFarmerOrganizations((prev) => prev.filter((r) => r.organization_id !== id));
    setHouseholds((prev) => prev.map((h) => (h.organization_id === id ? { ...h, organization_id: null } : h)));
    if (existing) {
      void logActivity({
        entityType: "organization",
        entityId: id,
        action: "deleted",
        barangay: existing.barangay ?? "ALL",
        before: pickFields(existing, ORGANIZATION_LOGGED_FIELDS),
        after: null,
        summary: summarizeOrganizationChange("deleted", existing, null),
        actor: actorRef.current,
        metadata: {
          cascade: {
            farmer_organizations_removed: cascadeMemberCount,
            households_detached: cascadeHouseholdCount,
          },
        },
      });
    }
    return { ok: true };
  }

  /* ── Farmer-Organizations ─────────────────────────────────────── */

  async function saveFarmerOrganizations(farmerId: string, organizationIds: string[]): Promise<MutationResult> {
    // Snapshot the previous membership before the delete-then-insert pair so
    // we can log a single "+N orgs / -M orgs" diff with full id arrays in
    // metadata. The plan calls for one log per logical action, not one per
    // join row touched.
    const beforeIds = farmerOrganizations
      .filter((r) => r.farmer_id === farmerId)
      .map((r) => r.organization_id);

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

    const diff = summarizeOrgMembershipChange(beforeIds, organizationIds);
    if (diff.added.length > 0 || diff.removed.length > 0) {
      const ownerBarangay =
        farmersRef.current.find((f) => f.id === farmerId)?.barangay ?? "";
      if (ownerBarangay) {
        void logActivity({
          entityType: "farmer_organization",
          // entity_id is the farmer's id — the natural pivot for "what orgs
          // is this farmer in" queries.
          entityId: farmerId,
          action: "org_membership_changed",
          barangay: ownerBarangay,
          before: { organizations: beforeIds },
          after: { organizations: organizationIds },
          summary: diff.summary,
          actor: actorRef.current,
          metadata: { added: diff.added, removed: diff.removed },
        });
      }
    }
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
    void logActivity({
      entityType: "farmer",
      entityId: row.id,
      action: "created",
      barangay: row.barangay,
      before: null,
      after: pickFields(row, FARMER_LOGGED_FIELDS),
      summary: summarizeFarmerChange("created", null, row),
      actor: actorRef.current,
    });
    return { ok: true, id: row.id };
  }

  async function updateFarmer(id: string, data: Omit<Farmer, "id" | "created_at" | "updated_at">): Promise<MutationResult> {
    const iso = new Date().toISOString();
    const existing = farmersRef.current.find((f) => f.id === id);
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

    if (existing) {
      const merged: Farmer = { ...existing, ...data, updated_at: iso };
      const diff = pickChangedFields(existing, merged, FARMER_LOGGED_FIELDS);
      if (diff.before || diff.after) {
        const action = resolveFarmerUpdateAction(existing, merged);
        void logActivity({
          entityType: "farmer",
          entityId: id,
          // farmer barangay can change on edit; tag with the *new* barangay
          // so the row is visible under the post-change scope.
          barangay: merged.barangay,
          action,
          before: diff.before,
          after: diff.after,
          summary: summarizeFarmerChange(action, existing, merged),
          actor: actorRef.current,
        });
      }
    }
    return { ok: true };
  }

  async function deleteFarmer(id: string) {
    // Snapshot BEFORE the soft delete so the activity log can capture
    // identity and report what stays attached.
    const existing = farmersRef.current.find((f) => f.id === id);
    const preservedAssetCount = farmerAssetsRef.current.filter((a) => a.farmer_id === id).length;
    const preservedRecordIds = recordsRef.current
      .filter((r) => r.farmer_ids?.includes(id))
      .map((r) => r.id);

    // Phase 6 (migration 020): soft delete. Unlike the prior hard-delete
    // path, we do NOT strip the farmer from agri_records.farmer_ids in the
    // DB, and we do NOT modify farmer_organizations or farmer_assets. Those
    // references stay intact so a future restore brings the farmer back
    // fully attached. Denormalized record fields (farmer_names, counts) are
    // historical snapshots and remain correct.
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("farmers")
      .update({ deleted_at: deletedAt })
      .eq("id", id);
    if (error) {
      console.error("[AgriData] deleteFarmer:", error.message);
      return;
    }

    // Local state: hide the farmer and their associated rows from the live
    // view. The DB rows remain untouched (except the farmer's deleted_at),
    // so a page reload after restoration will surface everything again.
    setFarmers((prev) => prev.filter((f) => f.id !== id));
    setFarmerOrganizations((prev) => prev.filter((r) => r.farmer_id !== id));
    setFarmerAssets((prev) => prev.filter((a) => a.farmer_id !== id));

    if (existing) {
      void logActivity({
        entityType: "farmer",
        entityId: id,
        action: "deleted",
        barangay: existing.barangay,
        before: pickFields(existing, FARMER_LOGGED_FIELDS),
        after: null,
        summary: summarizeFarmerChange("deleted", existing, null),
        actor: actorRef.current,
        metadata: {
          soft_delete: true,
          deleted_at: deletedAt,
          preserved: {
            agri_records_with_farmer_id: preservedRecordIds.length,
            farmer_assets_attached: preservedAssetCount,
          },
        },
      });
    }
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
