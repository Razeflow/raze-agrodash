export type CalamitySubCategory =
  | "None"
  | "Typhoon"
  | "Flood"
  | "Drought"
  | "Landslide"
  | "Fire"
  | "Hail"
  | "Earthquake"
  | "Other";

export const CALAMITY_SUB_CATEGORIES: CalamitySubCategory[] = [
  "None",
  "Typhoon",
  "Flood",
  "Drought",
  "Landslide",
  "Fire",
  "Hail",
  "Earthquake",
  "Other",
];

export const CALAMITY_SUB_CATEGORY_LABELS: Record<CalamitySubCategory, string> = {
  None: "None",
  Typhoon: "Typhoon",
  Flood: "Flood",
  Drought: "Drought",
  Landslide: "Landslide",
  Fire: "Fire",
  Hail: "Hail",
  Earthquake: "Earthquake",
  Other: "Other",
};

export function isCalamitySubCategory(s: string): s is CalamitySubCategory {
  return (CALAMITY_SUB_CATEGORIES as readonly string[]).includes(s);
}

/** Map DB / legacy values to a known category; unknown strings become `Other`. */
export function normalizeCalamitySubCategory(raw: unknown): CalamitySubCategory {
  if (typeof raw !== "string" || raw === "") return "None";
  return isCalamitySubCategory(raw) ? raw : "Other";
}

/**
 * Lifecycle of a single planting / stocking event.
 * - planted: area/stocking set, no harvest yet (default for new rows)
 * - damaged: mid-season pests/calamity logged but not finalized
 * - harvested: final harvest captured (only this status contributes to production totals)
 * - total_loss: finalized with zero output; the row's planting_area counts toward damage
 */
export type LifecycleStatus = "planted" | "damaged" | "harvested" | "total_loss";

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "planted",
  "damaged",
  "harvested",
  "total_loss",
];

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleStatus, string> = {
  planted: "Planted",
  damaged: "Damaged (mid-season)",
  harvested: "Harvested",
  total_loss: "Total loss",
};

export function isLifecycleStatus(s: unknown): s is LifecycleStatus {
  return typeof s === "string" && (LIFECYCLE_STATUSES as readonly string[]).includes(s);
}

export const isActiveStatus = (s: LifecycleStatus) => s === "planted" || s === "damaged";
export const isFinalizedStatus = (s: LifecycleStatus) => s === "harvested" || s === "total_loss";

/** Postgres Phase 2 lifecycle column when synced with legacy `lifecycle_status`. */
export type PhaseRecordStatus = "active" | "harvested" | "damaged" | "archived";

/** Denormalized commodity grouping from Postgres when present. */
export type AgriCommodityGroup = "CROP" | "FISHERY" | "LIVESTOCK";

export type AgriRecord = {
  id: string;
  barangay: string;
  commodity: "Rice" | "Corn" | "Fishery" | "High Value Crops" | "Industrial Crops" | "Livestock";
  sub_category: string;
  farmer_ids: string[];       // linked Farmer IDs
  farmer_names: string;       // denormalized from linked farmers
  farmer_male: number;        // denormalized count
  farmer_female: number;      // denormalized count
  total_farmers: number;      // denormalized count
  planting_area_hectares: number;
  harvesting_output_bags: number; // 40kg per bag
  damage_pests_hectares: number;
  damage_calamity_hectares: number;
  stocking: number;            // Fishery only
  harvesting_fishery: number;  // Fishery only
  /** Phase 1: fishery loss (pieces). */
  fishery_loss_pieces?: number | null;
  /** Phase 1: livestock (heads). */
  livestock_stocking_heads?: number | null;
  livestock_output_heads?: number | null;
  livestock_dead_heads?: number | null;
  pests_diseases: string;
  calamity: string;
  /** Controlled type: Typhoon, Flood, etc.; use `calamity` for event name / detail. */
  calamity_sub_category: CalamitySubCategory;
  remarks: string;
  period_month: number | null; // 1-12 reporting month
  period_year: number | null;  // e.g. 2026
  /** Lifecycle status — gates which aggregator buckets a row contributes to. */
  lifecycle_status: LifecycleStatus;
  /** Phase 2 lifecycle column (when present). */
  status?: PhaseRecordStatus | null;
  commodity_group?: AgriCommodityGroup | null;
  /**
   * Phase A (migration 017): optional FK to a LAND (planting_area) farmer_assets row.
   * When set, asset-level allocation rules apply; when null, household-level rules apply.
   */
  farmer_asset_id?: string | null;
  created_at: string;          // ISO timestamp
  updated_at: string;          // ISO timestamp
};

export type OrgType = "cooperative" | "association" | "household_group" | "other";

export type Organization = {
  id: string;
  name: string;
  org_type: OrgType;
  barangay: string | null;
  created_at: string;
  updated_at: string;
};

export type Household = {
  id: string;
  barangay: string;
  display_name: string;
  farming_area_hectares: number;
  rffa_subsidies_notes: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FarmerOrganizationRow = {
  farmer_id: string;
  organization_id: string;
};

export type SubsidyCategory =
  | "fish_fingerlings"
  | "fertilizer"
  | "cash"
  | "seeds"
  | "rice_seeds"
  | "other";

export const SUBSIDY_CATEGORIES: SubsidyCategory[] = [
  "fish_fingerlings",
  "fertilizer",
  "cash",
  "seeds",
  "rice_seeds",
  "other",
];

export const SUBSIDY_CATEGORY_LABELS: Record<SubsidyCategory, string> = {
  fish_fingerlings: "Fish fingerlings",
  fertilizer: "Fertilizer",
  cash: "Cash subsidy",
  seeds: "Seeds (other)",
  rice_seeds: "Rice seeds",
  other: "Other assistance",
};

export type HouseholdSubsidy = {
  id: string;
  household_id: string;
  category: SubsidyCategory;
  product_detail: string | null;
  quantity: number | null;
  unit: string | null;
  amount_php: number | null;
  program_source: string | null;
  received_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function isSubsidyCategory(s: string): s is SubsidyCategory {
  return (SUBSIDY_CATEGORIES as readonly string[]).includes(s);
}

/** Compact string for CSV / roster (e.g. "Fertilizer:Urea x2 bag; Cash subsidy PHP 3000"). */
export function formatHouseholdSubsidySummary(subs: HouseholdSubsidy[]): string {
  if (subs.length === 0) return "";
  return subs
    .map((s) => {
      const label = SUBSIDY_CATEGORY_LABELS[s.category];
      const det = s.product_detail?.trim() ? `:${s.product_detail.trim()}` : "";
      const qty =
        s.quantity != null && !Number.isNaN(s.quantity)
          ? ` x${s.quantity}${s.unit?.trim() ? ` ${s.unit.trim()}` : ""}`
          : "";
      const amt =
        s.amount_php != null && !Number.isNaN(s.amount_php)
          ? ` ${s.category === "cash" ? "PHP " : ""}${s.amount_php}`
          : "";
      return `${label}${det}${qty}${amt}`.replace(/\s+/g, " ").trim();
    })
    .join("; ");
}

export type FarmerAssetCategory =
  | "planting_area"
  | "machinery"
  | "fishpond"
  | "facility"
  | "livestock";

export const FARMER_ASSET_CATEGORIES: FarmerAssetCategory[] = [
  "planting_area",
  "machinery",
  "fishpond",
  "facility",
  "livestock",
];

export const FARMER_ASSET_CATEGORY_LABELS: Record<FarmerAssetCategory, string> = {
  planting_area: "Planting area",
  machinery: "Machinery",
  fishpond: "Fishpond",
  facility: "Facility",
  livestock: "Livestock",
};

export type MachinerySubCategory =
  | "hand_tractor"
  | "hand_tractor_with_trailer"
  | "multi_tiller"
  | "combine_thresher"
  | "walk_behind_reaper"
  | "transplanter"
  | "others";

export const MACHINERY_SUB_CATEGORIES: MachinerySubCategory[] = [
  "hand_tractor",
  "hand_tractor_with_trailer",
  "multi_tiller",
  "combine_thresher",
  "walk_behind_reaper",
  "transplanter",
  "others",
];

export const MACHINERY_SUB_CATEGORY_LABELS: Record<MachinerySubCategory, string> = {
  hand_tractor: "Hand tractor",
  hand_tractor_with_trailer: "Hand tractor with trailer",
  multi_tiller: "Multi tiller",
  combine_thresher: "Combine thresher",
  walk_behind_reaper: "Walk behind reaper",
  transplanter: "Transplanter",
  others: "Others",
};

export type FacilitySubCategory = "granary" | "others";

export const FACILITY_SUB_CATEGORIES: FacilitySubCategory[] = ["granary", "others"];

export const FACILITY_SUB_CATEGORY_LABELS: Record<FacilitySubCategory, string> = {
  granary: "Granary",
  others: "Others",
};

export type LivestockSubCategory =
  | "cattle"
  | "carabao"
  | "swine"
  | "goat"
  | "sheep"
  | "chicken"
  | "duck"
  | "turkey"
  | "rabbit"
  | "others";

export const LIVESTOCK_SUB_CATEGORIES: LivestockSubCategory[] = [
  "cattle",
  "carabao",
  "swine",
  "goat",
  "sheep",
  "chicken",
  "duck",
  "turkey",
  "rabbit",
  "others",
];

export const LIVESTOCK_SUB_CATEGORY_LABELS: Record<LivestockSubCategory, string> = {
  cattle: "Cattle",
  carabao: "Carabao",
  swine: "Swine",
  goat: "Goat",
  sheep: "Sheep",
  chicken: "Chicken",
  duck: "Duck",
  turkey: "Turkey",
  rabbit: "Rabbit",
  others: "Others",
};
export type FarmerAsset = {
  id: string;
  farmer_id: string;
  category: FarmerAssetCategory;
  sub_category: string | null;
  product_detail: string | null;
  quantity: number | null;
  unit: string | null;
  area_hectares: number | null;
  acquired_date: string | null;
  notes: string | null;
  /** Phase A (migration 017 §3): human-readable label for a LAND parcel, e.g. "Farm Lot A". */
  parcel_label?: string | null;
  /** Optional external identifier (cadastral / RSBSA / etc.). */
  parcel_code?: string | null;
  /** Parcel geometry as GeoJSON. Reserved for later PostGIS migration. */
  geom_geojson?: unknown | null;
  /** Denormalised centroid (WGS84) for quick map rendering. */
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  created_at: string;
  updated_at: string;
};

export function isFarmerAssetCategory(s: string): s is FarmerAssetCategory {
  return (FARMER_ASSET_CATEGORIES as readonly string[]).includes(s);
}

/** Sub-category options for a given asset category. Returns empty array if none apply. */
export function getAssetSubCategoryOptions(
  category: FarmerAssetCategory,
): { value: string; label: string }[] {
  if (category === "machinery") {
    return MACHINERY_SUB_CATEGORIES.map((s) => ({ value: s, label: MACHINERY_SUB_CATEGORY_LABELS[s] }));
  }
  if (category === "facility") {
    return FACILITY_SUB_CATEGORIES.map((s) => ({ value: s, label: FACILITY_SUB_CATEGORY_LABELS[s] }));
  }
  if (category === "livestock") {
    return LIVESTOCK_SUB_CATEGORIES.map((s) => ({ value: s, label: LIVESTOCK_SUB_CATEGORY_LABELS[s] }));
  }
  return [];
}

/** Human-readable label for a stored sub_category code (machinery / facility / livestock). */
export function formatAssetSubCategory(category: FarmerAssetCategory, sub: string | null): string {
  if (!sub) return "";
  if (category === "machinery") {
    return MACHINERY_SUB_CATEGORY_LABELS[sub as MachinerySubCategory] ?? sub;
  }
  if (category === "facility") {
    return FACILITY_SUB_CATEGORY_LABELS[sub as FacilitySubCategory] ?? sub;
  }
  if (category === "livestock") {
    return LIVESTOCK_SUB_CATEGORY_LABELS[sub as LivestockSubCategory] ?? sub;
  }
  return sub;
}

/** Compact one-line summary of a single asset for lists / CSV. */
export function formatFarmerAssetSummary(a: FarmerAsset): string {
  const cat = FARMER_ASSET_CATEGORY_LABELS[a.category];
  const sub = formatAssetSubCategory(a.category, a.sub_category);
  const det = a.product_detail?.trim() ? `:${a.product_detail.trim()}` : "";
  const qty =
    a.quantity != null && !Number.isNaN(a.quantity)
      ? ` x${a.quantity}${a.unit?.trim() ? ` ${a.unit.trim()}` : ""}`
      : "";
  const ha =
    a.area_hectares != null && !Number.isNaN(a.area_hectares)
      ? ` ${a.area_hectares} ha`
      : "";
  const head = sub ? `${cat} (${sub})` : cat;
  return `${head}${det}${qty}${ha}`.replace(/\s+/g, " ").trim();
}

export type Farmer = {
  id: string;
  name: string;
  gender: "Male" | "Female";
  barangay: string;
  household_id: string | null;
  /** Exactly one head per household is enforced in the app when marking a farmer as head. */
  is_household_head: boolean;
  rsbsa_number: string | null;
  birth_date: string | null;
  civil_status: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Phase Next — Activity Timeline / Operational History
 *
 * Append-only log of who did what, when. Written app-side from
 * lib/activity-log.ts after every successful Supabase mutation.
 * Mirrors migrations/019_activity_logs.sql. Keep this enum and the SQL
 * CHECK constraints in sync.
 * ────────────────────────────────────────────────────────────────────── */

export type ActivityEntityType =
  | "agri_record"
  | "farmer"
  | "household"
  | "farmer_asset"
  | "organization"
  | "household_subsidy"
  | "farmer_organization";

export const ACTIVITY_ENTITY_TYPES: ActivityEntityType[] = [
  "agri_record",
  "farmer",
  "household",
  "farmer_asset",
  "organization",
  "household_subsidy",
  "farmer_organization",
];

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "archived"
  | "land_allocation_changed"
  | "damage_updated"
  | "household_transferred"
  | "allocation_overflow_attempt"
  | "subsidy_added"
  | "subsidy_updated"
  | "subsidy_removed"
  | "org_membership_changed";

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  "created",
  "updated",
  "deleted",
  "status_changed",
  "archived",
  "land_allocation_changed",
  "damage_updated",
  "household_transferred",
  "allocation_overflow_attempt",
  "subsidy_added",
  "subsidy_updated",
  "subsidy_removed",
  "org_membership_changed",
];

/** Source of the log entry. 'db_trigger' is reserved for a later phase. */
export type ActivitySource = "app" | "db_trigger";

export type ActivityLog = {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: ActivityAction;
  /** Only changed fields, not a full row snapshot. NULL on creates. */
  before: Record<string, unknown> | null;
  /** Only changed fields, not a full row snapshot. NULL on deletes. */
  after: Record<string, unknown> | null;
  /** Pre-rendered one-liner for the timeline UI. */
  summary: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  barangay: string;
  source: ActivitySource;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function isActivityAction(s: string): s is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(s);
}

export function isActivityEntityType(s: string): s is ActivityEntityType {
  return (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(s);
}

export const CIVIL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
  "Divorced",
  "Common-law",
] as const;

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  cooperative: "Cooperative",
  association: "Association",
  household_group: "Household group",
  other: "Other",
};

export const BARANGAYS = [
  "Supo",
  "Poblacion",
  "Wayangan",
  "Kili",
  "Tiempo",
  "Amtuagan",
  "Tabacda",
  "Alangtin",
  "Dilong",
  "Tubtuba",
] as const;

export const COMMODITY_OPTIONS = [
  "Rice",
  "Corn",
  "Fishery",
  "High Value Crops",
  "Industrial Crops",
  "Livestock",
] as const;

export const SUB_TYPES: Record<string, string[]> = {
  Rice: ["Hybrid", "Inbred", "Traditional"],
  Corn: [],
  Fishery: ["Tilapia", "Eel", "Palileng", "Bunog", "Udang", "Wadingan", "Kenpa", "Frog", "Carp", "Hito"],
  Livestock: ["Cattle", "Carabao", "Swine", "Goat", "Sheep", "Chicken", "Duck", "Turkey", "Rabbit", "Other"],
  "High Value Crops": [
    "Coffee", "Mango", "Eggplant", "Ampalaya", "Pole Sitao", "Upo",
    "Squash", "Tomato", "Petchay", "Ginger", "Sili", "Cabbage",
    "Chinese Cabbage (Wombok)",
  ],
  "Industrial Crops": ["Sugarcane"],
};

/** Parse numeric fields from Supabase/CSV (may arrive as strings). */
export function numField(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Canonical commodity for analytics and forms. Fixes legacy casing/aliases and
 * infers Fishery when `sub_category` is a known fish species.
 */
export function normalizeCommodity(raw: unknown, sub_category?: string): AgriRecord["commodity"] {
  const sub = typeof sub_category === "string" ? sub_category.trim() : "";
  if (sub && SUB_TYPES.Fishery.includes(sub)) return "Fishery";
  if (sub && SUB_TYPES.Rice.includes(sub)) return "Rice";
  if (sub && SUB_TYPES.Livestock.includes(sub)) return "Livestock";
  if (sub && SUB_TYPES["High Value Crops"].includes(sub)) return "High Value Crops";
  if (sub && SUB_TYPES["Industrial Crops"].includes(sub)) return "Industrial Crops";

  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!s) return "High Value Crops";

  const lower = s.toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, AgriRecord["commodity"]> = {
    fishery: "Fishery",
    fish: "Fishery",
    fisheries: "Fishery",
    livestock: "Livestock",
    hvc: "High Value Crops",
    "high value crop": "High Value Crops",
    "high-value crops": "High Value Crops",
    industrial: "Industrial Crops",
  };
  if (aliases[lower]) return aliases[lower];

  const ci = COMMODITY_OPTIONS.find((c) => c.toLowerCase() === lower);
  if (ci) return ci;

  if (COMMODITY_OPTIONS.includes(s as (typeof COMMODITY_OPTIONS)[number])) return s as AgriRecord["commodity"];

  return "High Value Crops";
}

/**
 * Production output for a record — only `harvested` rows contribute.
 * Fishery returns fish count; crops return 40kg bag count.
 * Non-finalized or `total_loss` rows return 0 by design.
 */
export function productionOutputForRecord(r: AgriRecord): number {
  if (r.lifecycle_status !== "harvested") return 0;
  if (r.commodity === "Fishery") {
    return numField(r.harvesting_fishery);
  }
  if (r.commodity === "Livestock") {
    return numField(r.livestock_output_heads);
  }
  return numField(r.harvesting_output_bags);
}

/** Harvest totals by commodity group (only `harvested` lifecycle rows contribute). */
export function summarizeHarvestOutput(records: AgriRecord[]): {
  cropBags: number;
  fisheryFish: number;
  livestockHeads: number;
} {
  let cropBags = 0;
  let fisheryFish = 0;
  let livestockHeads = 0;
  for (const r of records) {
    const out = productionOutputForRecord(r);
    if (out <= 0) continue;
    if (r.commodity === "Fishery") fisheryFish += out;
    else if (r.commodity === "Livestock") livestockHeads += out;
    else cropBags += out;
  }
  return { cropBags, fisheryFish, livestockHeads };
}

/**
 * Damaged hectares for a record:
 * - planted        → 0 (no damage finalized yet)
 * - damaged        → pests + calamity (whatever was logged so far)
 * - harvested      → pests + calamity (residual mid-season damage on a row that still got a harvest)
 * - total_loss     → entire planting area (whole field was lost)
 * Fishery has no hectare-based damage, so this returns 0 for fishery rows.
 */
export function damageHectaresForRecord(r: AgriRecord): number {
  if (r.commodity === "Fishery") return 0;
  if (r.lifecycle_status === "planted") return 0;
  if (r.lifecycle_status === "total_loss") return numField(r.planting_area_hectares);
  return numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
}

export const COMMODITY_COLORS: Record<string, string> = {
  Rice: "#16a34a",
  Corn: "#ca8a04",
  Fishery: "#0284c7",
  "High Value Crops": "#9333ea",
  "Industrial Crops": "#ea580c",
  Livestock: "#9f1239",
};

// ── Philippine Timezone Helpers ──────────────────────────────────────────
const PH_TZ = "Asia/Manila";

/** Format a date string in Philippine timezone. */
export function formatDatePH(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", { timeZone: PH_TZ, ...options });
}

/** Format a date+time string in Philippine timezone. */
export function formatDateTimePH(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Get the current Philippine month (1-12) and year. */
export function getCurrentPHPeriod(): { month: number; year: number } {
  const now = new Date();
  const phStr = now.toLocaleString("en-US", { timeZone: PH_TZ, month: "numeric", year: "numeric" });
  const [m, y] = phStr.split("/").map(Number);
  return { month: m, year: y };
}

/** Format a period_month + period_year into a display string like "Mar 2026". */
export function formatPeriod(month: number | null, year: number | null): string {
  if (!month || !year) return "—";
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
