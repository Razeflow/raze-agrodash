import { z } from "zod";
import type { CommodityGroup } from "./commodity";
import { commodityGroupForCommodity } from "./commodity";
import type { RecordStatus } from "./status";
import { validateStatusEvidence } from "./lifecycle";

export type DomainIssue = {
  path: string[];
  message: string;
  code:
    | "required"
    | "invalid"
    | "disallowed_field"
    | "range"
    | "invariant"
    | "transition";
};

export type DomainValidationResult =
  | { ok: true }
  | { ok: false; issues: DomainIssue[] };

export const DOMAIN_LIMITS = {
  AREA_MAX: 10_000,
  BAGS_MAX: 1_000_000,
  PIECES_MAX: 1_000_000,
  HEADS_MAX: 1_000_000,
} as const;

const num = (max: number) => z.number().min(0).max(max);

/**
 * Domain payload: the minimal numeric surface we validate consistently
 * everywhere. Field names match the actual `AgriRecord` schema so callers
 * can pass an existing record directly without mapping. The Phase 2 spec
 * uses shorter aliases (`harvest_bags`, `damage_hectares`, `fishery_stocking`,
 * `fishery_harvest_pieces`) — when the DB columns are eventually renamed to
 * those, update both `AgriRecord` and this type at the same time.
 */
export type DomainRecordLike = {
  commodity: string;
  // Phase 2 status column (preferred). If absent, caller may pass derived status.
  status?: RecordStatus | null;

  // Crop fields (matches AgriRecord)
  planting_area_hectares?: number | null;
  harvesting_output_bags?: number | null;
  damage_pests_hectares?: number | null;
  damage_calamity_hectares?: number | null;

  // Fishery fields (matches AgriRecord — `stocking` and `harvesting_fishery`
  // are fishery-only despite the legacy generic naming)
  stocking?: number | null;
  harvesting_fishery?: number | null;
  fishery_loss_pieces?: number | null;

  // Livestock fields
  livestock_stocking_heads?: number | null;
  livestock_output_heads?: number | null;
  livestock_dead_heads?: number | null;
};

function push(issues: DomainIssue[], issue: DomainIssue) {
  issues.push(issue);
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export function groupForRecord(record: Pick<DomainRecordLike, "commodity">): CommodityGroup {
  return commodityGroupForCommodity(record.commodity as any);
}

/**
 * Enforce commodity field isolation + status evidence.
 * This is production-safe (never throws) and returns a structured error list.
 */
export function validateDomainRecord(input: {
  record: DomainRecordLike;
  group?: CommodityGroup;
  status?: RecordStatus;
}): DomainValidationResult {
  const issues: DomainIssue[] = [];
  const record = input.record;
  const group = input.group ?? groupForRecord(record);
  const status = (input.status ?? record.status ?? "active") as RecordStatus;

  // Normalize numeric values (treat null/undefined as 0).
  const crop = {
    planting_area_hectares: n(record.planting_area_hectares),
    harvesting_output_bags: n(record.harvesting_output_bags),
    damage_pests_hectares: n(record.damage_pests_hectares),
    damage_calamity_hectares: n(record.damage_calamity_hectares),
  };
  const cropDamageTotal = crop.damage_pests_hectares + crop.damage_calamity_hectares;

  const fishery = {
    stocking: n(record.stocking),
    harvesting_fishery: n(record.harvesting_fishery),
    fishery_loss_pieces: n(record.fishery_loss_pieces),
  };
  const livestock = {
    livestock_stocking_heads: n(record.livestock_stocking_heads),
    livestock_output_heads: n(record.livestock_output_heads),
    livestock_dead_heads: n(record.livestock_dead_heads),
  };

  // Basic numeric sanity (domain-level; DB has its own checks too).
  const sanity = z.object({
    planting_area_hectares: num(DOMAIN_LIMITS.AREA_MAX),
    harvesting_output_bags: num(DOMAIN_LIMITS.BAGS_MAX),
    damage_pests_hectares: num(DOMAIN_LIMITS.AREA_MAX),
    damage_calamity_hectares: num(DOMAIN_LIMITS.AREA_MAX),
    stocking: num(DOMAIN_LIMITS.PIECES_MAX),
    harvesting_fishery: num(DOMAIN_LIMITS.PIECES_MAX),
    fishery_loss_pieces: num(DOMAIN_LIMITS.PIECES_MAX),
    livestock_stocking_heads: num(DOMAIN_LIMITS.HEADS_MAX),
    livestock_output_heads: num(DOMAIN_LIMITS.HEADS_MAX),
    livestock_dead_heads: num(DOMAIN_LIMITS.HEADS_MAX),
  });
  const sanityRes = sanity.safeParse({
    ...crop,
    ...fishery,
    ...livestock,
  });
  if (!sanityRes.success) {
    for (const i of sanityRes.error.issues) {
      push(issues, { code: "range", path: [String(i.path[0] ?? "_")], message: i.message });
    }
  }

  // Commodity field isolation (PHASE 2 spec).
  if (group === "CROP") {
    if (fishery.stocking > 0 || fishery.harvesting_fishery > 0 || fishery.fishery_loss_pieces > 0) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Crop records cannot include fishery fields." });
    }
    if (livestock.livestock_stocking_heads > 0 || livestock.livestock_output_heads > 0 || livestock.livestock_dead_heads > 0) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Crop records cannot include livestock fields." });
    }
    if (crop.planting_area_hectares <= 0) {
      push(issues, { code: "required", path: ["planting_area_hectares"], message: "Planting area is required for crops." });
    }
    if (cropDamageTotal > crop.planting_area_hectares + 1e-6) {
      // Surface the error on the calamity field — matches the existing form's behavior.
      push(issues, { code: "invariant", path: ["damage_calamity_hectares"], message: "Damage hectares cannot exceed planting area." });
    }
  }

  if (group === "FISHERY") {
    if (
      crop.planting_area_hectares > 0
      || crop.harvesting_output_bags > 0
      || crop.damage_pests_hectares > 0
      || crop.damage_calamity_hectares > 0
    ) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Fishery records cannot include crop fields." });
    }
    if (livestock.livestock_stocking_heads > 0 || livestock.livestock_output_heads > 0 || livestock.livestock_dead_heads > 0) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Fishery records cannot include livestock fields." });
    }
    if (fishery.stocking <= 0) {
      push(issues, { code: "required", path: ["stocking"], message: "Fish stocked count is required for fishery." });
    }
    if (fishery.fishery_loss_pieces > fishery.stocking + 1e-6) {
      push(issues, { code: "invariant", path: ["fishery_loss_pieces"], message: "Fish lost cannot exceed fish stocked." });
    }
  }

  if (group === "LIVESTOCK") {
    if (
      crop.planting_area_hectares > 0
      || crop.harvesting_output_bags > 0
      || crop.damage_pests_hectares > 0
      || crop.damage_calamity_hectares > 0
    ) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Livestock records cannot include crop fields." });
    }
    if (fishery.stocking > 0 || fishery.harvesting_fishery > 0 || fishery.fishery_loss_pieces > 0) {
      push(issues, { code: "disallowed_field", path: ["commodity"], message: "Livestock records cannot include fishery fields." });
    }
    if (livestock.livestock_stocking_heads <= 0) {
      push(issues, { code: "required", path: ["livestock_stocking_heads"], message: "Stocking heads is required for livestock." });
    }
    if (livestock.livestock_dead_heads > livestock.livestock_stocking_heads + 1e-6) {
      push(issues, { code: "invariant", path: ["livestock_dead_heads"], message: "Dead heads cannot exceed stocking." });
    }
  }

  // Lifecycle evidence (status gates aggregation).
  const evidence = (() => {
    if (group === "CROP") {
      return {
        baseSize: crop.planting_area_hectares,
        output: crop.harvesting_output_bags,
        loss: cropDamageTotal,
      };
    }
    if (group === "FISHERY") {
      return {
        baseSize: fishery.stocking,
        output: fishery.harvesting_fishery,
        loss: fishery.fishery_loss_pieces,
      };
    }
    return {
      baseSize: livestock.livestock_stocking_heads,
      output: livestock.livestock_output_heads,
      loss: livestock.livestock_dead_heads,
    };
  })();

  const statusRes = validateStatusEvidence({ group, status, ...evidence });
  if (!statusRes.ok) {
    push(issues, { code: "transition", path: ["status"], message: statusRes.reason });
  }

  if (issues.length === 0) return { ok: true };
  return { ok: false, issues };
}

/**
 * Shape DomainIssue[] for the existing form/error-banner surfaces.
 *
 * - `fieldErrors`: keyed by `path[0]` exactly like zodIssuesToErrors in
 *   lib/validations.ts, so callers can merge it straight into FormErrors.
 *   First issue per field wins (matches Zod behavior).
 * - `message`: a single human-readable line for the dialog banner / the
 *   mutation-layer `{ ok: false, message }` shape. Path-less issues lead.
 */
export function formatDomainIssues(issues: DomainIssue[]): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = (issue.path[0] ?? "_root") as string;
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const message = issues.map((i) => i.message).join("; ");
  return { message, fieldErrors };
}
