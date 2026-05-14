/**
 * Row normalizers — translate raw Supabase row objects (loose `Record<string, unknown>`
 * shapes from PostgREST) into the strict TS types used throughout the app.
 *
 * Lives outside agri-context so the data context can stay focused on state +
 * mutations, and so these helpers can be unit-tested without React deps.
 */

import {
  isActivityAction,
  isActivityEntityType,
  isFarmerAssetCategory,
  isLifecycleStatus,
  isSubsidyCategory,
  normalizeCalamitySubCategory,
  normalizeCommodity,
  numField,
  type ActivityLog,
  type ActivitySource,
  type AgriRecord,
  type Farmer,
  type FarmerAsset,
  type FarmerAssetCategory,
  type HouseholdSubsidy,
  type LifecycleStatus,
  type SubsidyCategory,
} from "@/lib/data";
import { commodityGroupForCommodity } from "@/lib/domain/commodity";

export function normalizeHouseholdSubsidy(row: Record<string, unknown>): HouseholdSubsidy {
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

export function normalizeFarmerAsset(row: Record<string, unknown>): FarmerAsset {
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
    parcel_label: row.parcel_label != null ? String(row.parcel_label) : null,
    parcel_code: row.parcel_code != null ? String(row.parcel_code) : null,
    geom_geojson: row.geom_geojson ?? null,
    centroid_lat: row.centroid_lat != null && row.centroid_lat !== "" ? Number(row.centroid_lat) : null,
    centroid_lng: row.centroid_lng != null && row.centroid_lng !== "" ? Number(row.centroid_lng) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function normalizeFarmer(row: Record<string, unknown>): Farmer {
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

/** Phase 2 `status` column from Postgres (optional until synced everywhere). */
function parsePhaseRecordStatus(raw: unknown): AgriRecord["status"] | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s === "active" || s === "harvested" || s === "damaged" || s === "archived") return s;
  return undefined;
}

function parseAgriCommodityGroup(raw: unknown): AgriRecord["commodity_group"] | undefined {
  if (typeof raw !== "string") return undefined;
  const g = raw.trim().toUpperCase();
  if (g === "CROP" || g === "FISHERY" || g === "LIVESTOCK") return g;
  return undefined;
}

/**
 * Derive a lifecycle status for a row that's missing the column (e.g. a record
 * created before migration 010 was applied). Mirrors the SQL backfill so client
 * and server agree on the inferred status.
 */
export function deriveLifecycleStatus(r: AgriRecord): LifecycleStatus {
  if (r.commodity === "Fishery") {
    return numField(r.harvesting_fishery) > 0 ? "harvested" : "planted";
  }
  if (numField(r.harvesting_output_bags) > 0) return "harvested";
  const damage = numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
  const area = numField(r.planting_area_hectares);
  if (area > 0 && damage >= area) return "total_loss";
  if (damage > 0) return "damaged";
  return "planted";
}

export function normalizeAgriRecord(row: Record<string, unknown>): AgriRecord {
  const r = row as unknown as AgriRecord;
  const sub = typeof r.sub_category === "string" ? r.sub_category : String(r.sub_category ?? "");
  const base: AgriRecord = {
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
    lifecycle_status: isLifecycleStatus(row.lifecycle_status) ? row.lifecycle_status : "planted",
  };
  // If the row arrived without a status (pre-migration row), derive it from
  // the numeric fields so aggregations don't dump everything into "planted".
  if (!isLifecycleStatus(row.lifecycle_status)) {
    base.lifecycle_status = deriveLifecycleStatus(base);
  }

  const phaseStatus = parsePhaseRecordStatus(row.status);
  if (phaseStatus) base.status = phaseStatus;

  base.commodity_group =
    parseAgriCommodityGroup(row.commodity_group) ?? commodityGroupForCommodity(base.commodity);

  if (row.fishery_loss_pieces != null && row.fishery_loss_pieces !== "") {
    base.fishery_loss_pieces = numField(row.fishery_loss_pieces);
  }
  if (row.livestock_stocking_heads != null && row.livestock_stocking_heads !== "") {
    base.livestock_stocking_heads = numField(row.livestock_stocking_heads);
  }
  if (row.livestock_output_heads != null && row.livestock_output_heads !== "") {
    base.livestock_output_heads = numField(row.livestock_output_heads);
  }
  if (row.livestock_dead_heads != null && row.livestock_dead_heads !== "") {
    base.livestock_dead_heads = numField(row.livestock_dead_heads);
  }

  // Phase A: optional FK to a LAND asset (migration 017).
  base.farmer_asset_id =
    typeof row.farmer_asset_id === "string" && row.farmer_asset_id.length > 0
      ? row.farmer_asset_id
      : null;

  return base;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Phase Next — Activity Timeline (migration 019)
 * ────────────────────────────────────────────────────────────────────── */

function parseJsonbObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

function parseActivitySource(raw: unknown): ActivitySource {
  return raw === "db_trigger" ? "db_trigger" : "app";
}

export function normalizeActivityLog(row: Record<string, unknown>): ActivityLog {
  const entityTypeRaw = String(row.entity_type ?? "");
  const actionRaw = String(row.action ?? "");
  return {
    id: String(row.id),
    entity_type: isActivityEntityType(entityTypeRaw) ? entityTypeRaw : "agri_record",
    entity_id: String(row.entity_id ?? ""),
    action: isActivityAction(actionRaw) ? actionRaw : "updated",
    before: parseJsonbObject(row.before),
    after: parseJsonbObject(row.after),
    summary: row.summary != null ? String(row.summary) : null,
    performed_by:
      typeof row.performed_by === "string" && row.performed_by.length > 0
        ? row.performed_by
        : null,
    performed_by_name:
      row.performed_by_name != null ? String(row.performed_by_name) : null,
    performed_by_role:
      row.performed_by_role != null ? String(row.performed_by_role) : null,
    barangay: String(row.barangay ?? ""),
    source: parseActivitySource(row.source),
    metadata: parseJsonbObject(row.metadata),
    created_at: String(row.created_at ?? ""),
  };
}
