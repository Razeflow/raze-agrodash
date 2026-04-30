import { z } from "zod";
import { CALAMITY_SUB_CATEGORIES, COMMODITY_OPTIONS, BARANGAYS } from "./data";

/**
 * Sanity bounds for numeric record fields. These mirror the Postgres CHECK
 * constraints in `migrations/008_records_check_constraints.sql` so client-side
 * validation catches bad data before it ever hits the wire.
 *
 * Bounds are intentionally generous — they reject obvious typos
 * (e.g. 999_999 ha) without blocking legitimate edge cases.
 */
export const RECORD_LIMITS = {
  AREA_MAX: 10_000, // hectares
  BAGS_MAX: 1_000_000, // 40 kg bags
  STOCKING_MAX: 1_000_000,
  FISHERY_HARVEST_MAX: 1_000_000,
  FARMERS_MAX: 10_000,
  YEAR_MIN: 2020,
  YEAR_MAX: 2100,
} as const;

const ha = (label: string, max = RECORD_LIMITS.AREA_MAX) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} looks too large (max ${max.toLocaleString()})`);

const bags = (label: string, max = RECORD_LIMITS.BAGS_MAX) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} looks too large (max ${max.toLocaleString()})`);

// Zod v4 enums require a literal tuple. Cast the readonly arrays at call site.
const BARANGAY_VALUES = [...BARANGAYS] as [string, ...string[]];
const COMMODITY_VALUES = [...COMMODITY_OPTIONS] as [string, ...string[]];
const CALAMITY_VALUES = [...CALAMITY_SUB_CATEGORIES] as [string, ...string[]];

/**
 * Schema for the data submitted from `RecordFormDialog`.
 * The record form omits server-set fields (id, timestamps, denormalized counts)
 * so this matches the form's payload shape exactly.
 */
export const recordFormSchema = z
  .object({
    barangay: z.enum(BARANGAY_VALUES, { error: "Pick a valid barangay" }),
    commodity: z.enum(COMMODITY_VALUES, { error: "Commodity is required" }),
    sub_category: z.string(),
    farmer_ids: z
      .array(z.string())
      .min(1, "At least one farmer/fisherfolk must be selected"),
    period_month: z
      .number({ error: "Reporting month is required" })
      .int()
      .min(1, "Reporting month is required")
      .max(12, "Invalid month"),
    period_year: z
      .number({ error: "Reporting year is required" })
      .int()
      .min(RECORD_LIMITS.YEAR_MIN, `Year must be ${RECORD_LIMITS.YEAR_MIN} or later`)
      .max(RECORD_LIMITS.YEAR_MAX, `Year must be ${RECORD_LIMITS.YEAR_MAX} or earlier`),
    planting_area_hectares: ha("Planting area"),
    harvesting_output_bags: bags("Harvest output"),
    damage_pests_hectares: ha("Pests damage"),
    damage_calamity_hectares: ha("Calamity damage"),
    stocking: bags("Stocking", RECORD_LIMITS.STOCKING_MAX),
    harvesting_fishery: bags("Harvesting (fishery)", RECORD_LIMITS.FISHERY_HARVEST_MAX),
    pests_diseases: z.string().max(500, "Pests notes too long"),
    calamity: z.string().max(500, "Calamity notes too long"),
    calamity_sub_category: z.enum(CALAMITY_VALUES),
    remarks: z.string().max(2_000, "Remarks too long"),
  })
  .superRefine((val, ctx) => {
    // Cross-field: damage cannot exceed planting area (skip for Fishery — those
    // fields are reset to 0 anyway, but the check naturally passes for 0+0<=0).
    if (val.commodity !== "Fishery") {
      const totalDamage = val.damage_pests_hectares + val.damage_calamity_hectares;
      if (totalDamage > val.planting_area_hectares) {
        ctx.addIssue({
          code: "custom",
          path: ["damage_calamity_hectares"],
          message: `Total damage (${totalDamage.toFixed(2)} ha) exceeds planting area (${val.planting_area_hectares.toFixed(2)} ha)`,
        });
      }
    }
    // Cross-field: if a calamity type is set, calamity event/name should not be empty
    if (val.calamity_sub_category !== "None" && val.calamity.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["calamity"],
        message: `Describe the ${val.calamity_sub_category.toLowerCase()} event (or set type to None)`,
      });
    }
  });

export type RecordFormInput = z.infer<typeof recordFormSchema>;

/**
 * Schema for `FarmerFormDialog` payload (pre-orgs).
 * Lighter than the record schema — farmers have fewer numeric fields.
 */
export const farmerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  gender: z.enum(["Male", "Female"]),
  barangay: z.enum(BARANGAY_VALUES, { error: "Pick a valid barangay" }),
  rsbsa_number: z
    .string()
    .trim()
    .max(40, "RSBSA number is too long")
    .optional()
    .or(z.literal("")),
  birth_date: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => {
        if (!v) return true;
        const t = Date.parse(v);
        if (Number.isNaN(t)) return false;
        const min = new Date("1900-01-01").getTime();
        const max = Date.now();
        return t >= min && t <= max;
      },
      { message: "Birth date must be between 1900 and today" },
    ),
  civil_status: z
    .string()
    .max(40, "Civil status is too long")
    .optional()
    .or(z.literal("")),
});

export type FarmerFormInput = z.infer<typeof farmerFormSchema>;

/**
 * Map a Zod issue array to a `Record<fieldKey, string>` so existing form code
 * (which already keys errors by field name) keeps working unchanged.
 */
export function zodIssuesToErrors(
  issues: readonly z.core.$ZodIssue[],
): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const issue of issues) {
    const key = (issue.path[0] ?? "_root") as string;
    if (!errs[key]) errs[key] = issue.message;
  }
  return errs;
}
