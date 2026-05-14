/**
 * Activity / operational-history domain module.
 *
 * Pure: zero React, zero Supabase. Only types from lib/data.ts and primitive
 * helpers. The impure write side lives in lib/activity-log.ts.
 *
 * Responsibilities:
 *   1. Diff helpers — given a before/after pair, return only the fields that
 *      actually changed (with a tolerance for floating-point hectare math).
 *   2. Action resolver — given a record diff, pick the most specific
 *      semantic ActivityAction (e.g. status_changed > damage_updated > updated).
 *   3. Summary builders — pre-render one-line strings for the timeline UI.
 *   4. Field-set definitions — which AgriRecord fields are "damage" vs
 *      "allocation" vs "status" so the resolver and summary share one source
 *      of truth.
 *
 * Keep this in lockstep with the CHECK constraints in migration 019 and the
 * enums in lib/data.ts.
 */

import type {
  ActivityAction,
  AgriRecord,
  Farmer,
  FarmerAsset,
  Household,
  HouseholdSubsidy,
  Organization,
} from "@/lib/data";

const FP_EPS = 1e-6;

/** Field groups on AgriRecord that drive action resolution. */
const RECORD_STATUS_FIELDS = ["status", "lifecycle_status"] as const;
const RECORD_DAMAGE_FIELDS = [
  "damage_pests_hectares",
  "damage_calamity_hectares",
  "fishery_loss_pieces",
  "livestock_dead_heads",
] as const;
const RECORD_ALLOCATION_FIELDS = [
  "farmer_asset_id",
  "planting_area_hectares",
] as const;

type AnyObj = Record<string, unknown>;

/**
 * Returns true if two values are equal for diff purposes. Tolerates
 * floating-point noise on numbers (hectare math is the obvious offender).
 * Treats null/undefined/empty-string as equivalent so a missing field and an
 * empty field don't look like a change.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  const na = a === undefined || a === "" ? null : a;
  const nb = b === undefined || b === "" ? null : b;
  if (na === nb) return true;
  if (na === null || nb === null) return false;
  if (typeof na === "number" && typeof nb === "number") {
    if (Number.isNaN(na) && Number.isNaN(nb)) return true;
    return Math.abs(na - nb) < FP_EPS;
  }
  if (Array.isArray(na) && Array.isArray(nb)) {
    if (na.length !== nb.length) return false;
    for (let i = 0; i < na.length; i += 1) {
      if (!valuesEqual(na[i], nb[i])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Given before/after objects and an explicit list of keys to consider, return
 * `{ before, after }` objects containing ONLY the fields whose values differ.
 * Both halves use the same key set, so the diff is symmetric.
 *
 * Returns `{ before: null, after: null }` if nothing changed — callers can
 * skip logging in that case, or log a `updated` row with no payload (we
 * choose to skip in lib/activity-log.ts).
 */
export function pickChangedFields<T extends AnyObj>(
  before: T | null | undefined,
  after: T | null | undefined,
  keys: readonly (keyof T)[],
): { before: AnyObj | null; after: AnyObj | null } {
  const b: AnyObj = {};
  const a: AnyObj = {};
  let changed = false;
  for (const k of keys) {
    const bv = before ? (before as AnyObj)[k as string] : undefined;
    const av = after ? (after as AnyObj)[k as string] : undefined;
    if (!valuesEqual(bv, av)) {
      b[k as string] = bv ?? null;
      a[k as string] = av ?? null;
      changed = true;
    }
  }
  return changed ? { before: b, after: a } : { before: null, after: null };
}

/**
 * Pick a subset of fields from a record. Skips undefined/empty-string values.
 * Use for the `after` payload on `created` actions and `before` payload on
 * `deleted` actions — when there's nothing to diff against, we still want a
 * compact snapshot of the most useful fields.
 */
export function pickFields<T extends AnyObj>(
  source: T | null | undefined,
  keys: readonly (keyof T)[],
): AnyObj | null {
  if (!source) return null;
  const out: AnyObj = {};
  let any = false;
  for (const k of keys) {
    const v = (source as AnyObj)[k as string];
    if (v === undefined || v === "") continue;
    out[k as string] = v ?? null;
    any = true;
  }
  return any ? out : null;
}

/** Returns the set of keys that differ between two objects across the given key list. */
export function changedKeys<T extends AnyObj>(
  before: T | null | undefined,
  after: T | null | undefined,
  keys: readonly (keyof T)[],
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const bv = before ? (before as AnyObj)[k as string] : undefined;
    const av = after ? (after as AnyObj)[k as string] : undefined;
    if (!valuesEqual(bv, av)) out.push(k as string);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Action resolver — AgriRecord
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Pick the most specific ActivityAction for an AgriRecord update. Priority:
 *   archived > status_changed > land_allocation_changed > damage_updated > updated
 *
 * The label drives icon + color in the timeline; the `before`/`after` payload
 * still carries every changed field regardless of which label wins.
 */
export function resolveAgriRecordUpdateAction(
  before: AgriRecord,
  after: AgriRecord,
): ActivityAction {
  const statusChanged = !valuesEqual(before.status ?? null, after.status ?? null);
  if (statusChanged && after.status === "archived") return "archived";
  if (statusChanged) return "status_changed";

  const allocChanged =
    changedKeys(before, after, RECORD_ALLOCATION_FIELDS).length > 0;
  if (allocChanged) return "land_allocation_changed";

  const damageChanged =
    changedKeys(before, after, RECORD_DAMAGE_FIELDS).length > 0;
  if (damageChanged) return "damage_updated";

  return "updated";
}

/**
 * Field set worth diffing on an AgriRecord update. Excludes denormalized
 * counts (farmer_male/female/total) and timestamps so we don't log noise.
 */
export const AGRI_RECORD_LOGGED_FIELDS = [
  ...RECORD_STATUS_FIELDS,
  ...RECORD_DAMAGE_FIELDS,
  ...RECORD_ALLOCATION_FIELDS,
  "commodity",
  "sub_category",
  "farmer_ids",
  "period_month",
  "period_year",
  "harvesting_output_bags",
  "harvesting_fishery",
  "livestock_stocking_heads",
  "livestock_output_heads",
  "pests_diseases",
  "calamity",
  "calamity_sub_category",
  "remarks",
] as const satisfies readonly (keyof AgriRecord)[];

/* ─────────────────────────────────────────────────────────────────────────
 * Action resolver — Farmer
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Farmer-specific resolver. A household_id change is semantically a transfer.
 */
export function resolveFarmerUpdateAction(
  before: Farmer,
  after: Farmer,
): ActivityAction {
  if (!valuesEqual(before.household_id, after.household_id)) {
    return "household_transferred";
  }
  return "updated";
}

export const FARMER_LOGGED_FIELDS = [
  "name",
  "gender",
  "barangay",
  "household_id",
  "is_household_head",
  "rsbsa_number",
  "birth_date",
  "civil_status",
] as const satisfies readonly (keyof Farmer)[];

/* ─────────────────────────────────────────────────────────────────────────
 * Logged-field sets for other entities (action is always created/updated/deleted)
 * ────────────────────────────────────────────────────────────────────── */

export const HOUSEHOLD_LOGGED_FIELDS = [
  "barangay",
  "display_name",
  "farming_area_hectares",
  "organization_id",
  "rffa_subsidies_notes",
] as const satisfies readonly (keyof Household)[];

export const FARMER_ASSET_LOGGED_FIELDS = [
  "category",
  "sub_category",
  "product_detail",
  "quantity",
  "unit",
  "area_hectares",
  "parcel_label",
  "parcel_code",
  "acquired_date",
  "notes",
] as const satisfies readonly (keyof FarmerAsset)[];

export const ORGANIZATION_LOGGED_FIELDS = [
  "name",
  "org_type",
  "barangay",
] as const satisfies readonly (keyof Organization)[];

export const HOUSEHOLD_SUBSIDY_LOGGED_FIELDS = [
  "category",
  "product_detail",
  "quantity",
  "unit",
  "amount_php",
  "program_source",
  "received_date",
  "notes",
] as const satisfies readonly (keyof HouseholdSubsidy)[];

/* ─────────────────────────────────────────────────────────────────────────
 * Summary builders — produce the pre-rendered one-liner shown in the timeline
 * ────────────────────────────────────────────────────────────────────── */

/** Format a hectare value with two decimals, or "—" if null/NaN. */
function ha(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} ha` : "—";
}

function commaJoin(parts: string[]): string {
  return parts.filter(Boolean).join(", ");
}

/** Build a summary for an AgriRecord change. Action label tells us which fields to highlight. */
export function summarizeAgriRecordChange(
  action: ActivityAction,
  before: AgriRecord | null,
  after: AgriRecord | null,
): string {
  if (action === "created" && after) {
    return `Record created — ${after.commodity}${
      after.sub_category ? ` (${after.sub_category})` : ""
    }`;
  }
  if (action === "deleted" && before) {
    return `Record deleted — ${before.commodity}${
      before.sub_category ? ` (${before.sub_category})` : ""
    }`;
  }
  if (!before || !after) return "Record updated";

  if (action === "archived") return `Status: ${before.status ?? "—"} → archived`;
  if (action === "status_changed") {
    return `Status: ${before.status ?? "—"} → ${after.status ?? "—"}`;
  }
  if (action === "land_allocation_changed") {
    const parts: string[] = [];
    if (!valuesEqual(before.farmer_asset_id, after.farmer_asset_id)) {
      parts.push(
        `Land asset: ${before.farmer_asset_id ?? "—"} → ${after.farmer_asset_id ?? "—"}`,
      );
    }
    if (!valuesEqual(before.planting_area_hectares, after.planting_area_hectares)) {
      parts.push(
        `Area: ${ha(before.planting_area_hectares)} → ${ha(after.planting_area_hectares)}`,
      );
    }
    return commaJoin(parts) || "Land allocation changed";
  }
  if (action === "damage_updated") {
    const beforeDamage =
      Number(before.damage_pests_hectares ?? 0) +
      Number(before.damage_calamity_hectares ?? 0);
    const afterDamage =
      Number(after.damage_pests_hectares ?? 0) +
      Number(after.damage_calamity_hectares ?? 0);
    return `Damage: ${ha(beforeDamage)} → ${ha(afterDamage)}`;
  }
  return "Record updated";
}

/** Generic "X changed: A → B" summary for non-record entities. */
export function summarizeFieldChanges(
  before: AnyObj | null,
  after: AnyObj | null,
  prettyLabels: Record<string, string> = {},
): string {
  if (!before || !after) return "Updated";
  const parts: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const bv = before[k];
    const av = after[k];
    if (valuesEqual(bv, av)) continue;
    const label = prettyLabels[k] ?? k;
    parts.push(`${label}: ${formatScalar(bv)} → ${formatScalar(av)}`);
  }
  return commaJoin(parts) || "Updated";
}

function formatScalar(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Per-entity summary builders for Phase 3 (farmers / households / assets /
 * orgs / subsidies / org membership). Each falls back to the generic
 * `summarizeFieldChanges` for the multi-field-diff case, but customises the
 * "headline" for the most actionable change (e.g. household_transferred,
 * created, deleted).
 * ────────────────────────────────────────────────────────────────────── */

const FARMER_LABELS: Record<string, string> = {
  name: "Name",
  gender: "Gender",
  barangay: "Barangay",
  household_id: "Household",
  is_household_head: "Head of household",
  rsbsa_number: "RSBSA #",
  birth_date: "Birth date",
  civil_status: "Civil status",
};

export function summarizeFarmerChange(
  action: ActivityAction,
  before: Farmer | null,
  after: Farmer | null,
): string {
  if (action === "created" && after) return `Farmer registered — ${after.name}`;
  if (action === "deleted" && before) return `Farmer deleted — ${before.name}`;
  if (action === "household_transferred" && before && after) {
    return `Household: ${before.household_id ?? "—"} → ${after.household_id ?? "—"}`;
  }
  if (!before || !after) return "Farmer updated";
  return summarizeFieldChanges(
    pickFields(before, FARMER_LOGGED_FIELDS),
    pickFields(after, FARMER_LOGGED_FIELDS),
    FARMER_LABELS,
  );
}

const HOUSEHOLD_LABELS: Record<string, string> = {
  barangay: "Barangay",
  display_name: "Display name",
  farming_area_hectares: "Farming area (ha)",
  organization_id: "Organization",
  rffa_subsidies_notes: "RFFA notes",
};

export function summarizeHouseholdChange(
  action: ActivityAction,
  before: Household | null,
  after: Household | null,
): string {
  if (action === "created" && after) {
    return `Household created — ${after.display_name || after.id.slice(0, 8)}`;
  }
  if (action === "deleted" && before) {
    return `Household deleted — ${before.display_name || before.id.slice(0, 8)}`;
  }
  if (!before || !after) return "Household updated";
  return summarizeFieldChanges(
    pickFields(before, HOUSEHOLD_LOGGED_FIELDS),
    pickFields(after, HOUSEHOLD_LOGGED_FIELDS),
    HOUSEHOLD_LABELS,
  );
}

const FARMER_ASSET_LABELS: Record<string, string> = {
  category: "Category",
  sub_category: "Sub-category",
  product_detail: "Detail",
  quantity: "Quantity",
  unit: "Unit",
  area_hectares: "Area (ha)",
  parcel_label: "Parcel label",
  parcel_code: "Parcel code",
  acquired_date: "Acquired",
  notes: "Notes",
};

export function summarizeFarmerAssetChange(
  action: ActivityAction,
  before: FarmerAsset | null,
  after: FarmerAsset | null,
): string {
  if (action === "created" && after) {
    const label = after.parcel_label?.trim() || after.product_detail || after.category;
    return `Asset added — ${label} (${after.category})`;
  }
  if (action === "deleted" && before) {
    const label = before.parcel_label?.trim() || before.product_detail || before.category;
    return `Asset deleted — ${label} (${before.category})`;
  }
  if (!before || !after) return "Asset updated";
  return summarizeFieldChanges(
    pickFields(before, FARMER_ASSET_LOGGED_FIELDS),
    pickFields(after, FARMER_ASSET_LOGGED_FIELDS),
    FARMER_ASSET_LABELS,
  );
}

const ORGANIZATION_LABELS: Record<string, string> = {
  name: "Name",
  org_type: "Type",
  barangay: "Barangay",
};

export function summarizeOrganizationChange(
  action: ActivityAction,
  before: Organization | null,
  after: Organization | null,
): string {
  if (action === "created" && after) return `Organization created — ${after.name}`;
  if (action === "deleted" && before) return `Organization deleted — ${before.name}`;
  if (!before || !after) return "Organization updated";
  return summarizeFieldChanges(
    pickFields(before, ORGANIZATION_LOGGED_FIELDS),
    pickFields(after, ORGANIZATION_LOGGED_FIELDS),
    ORGANIZATION_LABELS,
  );
}

const HOUSEHOLD_SUBSIDY_LABELS: Record<string, string> = {
  category: "Category",
  product_detail: "Detail",
  quantity: "Quantity",
  unit: "Unit",
  amount_php: "Amount (PHP)",
  program_source: "Program source",
  received_date: "Received",
  notes: "Notes",
};

export function summarizeHouseholdSubsidyChange(
  action: ActivityAction,
  before: HouseholdSubsidy | null,
  after: HouseholdSubsidy | null,
): string {
  if (action === "subsidy_added" && after) {
    const detail = after.product_detail?.trim() ? `: ${after.product_detail.trim()}` : "";
    return `Subsidy added — ${after.category}${detail}`;
  }
  if (action === "subsidy_removed" && before) {
    const detail = before.product_detail?.trim() ? `: ${before.product_detail.trim()}` : "";
    return `Subsidy removed — ${before.category}${detail}`;
  }
  if (!before || !after) return "Subsidy updated";
  return summarizeFieldChanges(
    pickFields(before, HOUSEHOLD_SUBSIDY_LOGGED_FIELDS),
    pickFields(after, HOUSEHOLD_SUBSIDY_LOGGED_FIELDS),
    HOUSEHOLD_SUBSIDY_LABELS,
  );
}

/** Diff between two sets of organization IDs for a single farmer. */
export function summarizeOrgMembershipChange(
  beforeOrgIds: readonly string[],
  afterOrgIds: readonly string[],
): { summary: string; added: string[]; removed: string[] } {
  const beforeSet = new Set(beforeOrgIds);
  const afterSet = new Set(afterOrgIds);
  const added: string[] = [];
  const removed: string[] = [];
  for (const id of afterSet) if (!beforeSet.has(id)) added.push(id);
  for (const id of beforeSet) if (!afterSet.has(id)) removed.push(id);
  const parts: string[] = [];
  if (added.length > 0) parts.push(`+${added.length} org${added.length === 1 ? "" : "s"}`);
  if (removed.length > 0) parts.push(`-${removed.length} org${removed.length === 1 ? "" : "s"}`);
  const summary =
    parts.length > 0 ? `Org memberships: ${parts.join(", ")}` : "Org memberships unchanged";
  return { summary, added, removed };
}
