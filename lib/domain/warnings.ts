/**
 * Data-quality warnings — soft signals that should prompt the user, not
 * block them. Distinct from validation errors (lib/domain/validation.ts)
 * which DO block.
 *
 * Pilot scope: farmer duplicate detection (name + RSBSA). Future warnings
 * (suspicious yield, high damage on non-calamity submit, etc.) plug in via
 * the same DataWarning shape.
 */

import type { Farmer } from "@/lib/data";

export type DataWarningSeverity = "info" | "warn";

export type DataWarningCode =
  | "duplicate_farmer_name"
  | "duplicate_farmer_rsbsa";

export type DataWarning = {
  code: DataWarningCode;
  severity: DataWarningSeverity;
  message: string;
  /** Form field paths to highlight, if any. */
  paths?: string[];
};

/**
 * Normalize a free-text name for comparison: lowercase, collapse internal
 * whitespace, trim ends. Conservative — does NOT reorder name parts
 * (Filipino name conventions are inconsistent enough that reordering
 * generates false positives).
 */
export function normalizeNameForCompare(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Normalize an RSBSA number for comparison. RSBSA numbers are
 * machine-printed government identifiers; collapse case + whitespace but
 * preserve dashes/digits exactly.
 */
export function normalizeRsbsaForCompare(rsbsa: string): string {
  return rsbsa.trim().toLowerCase().replace(/\s+/g, "");
}

export type FarmerDuplicateMatch = {
  kind: "name" | "rsbsa";
  /** The existing farmer that matches. */
  farmer: Farmer;
};

/**
 * Look for a likely duplicate of the candidate within the same barangay.
 * Returns the first match found (RSBSA matches take precedence over name
 * matches when both exist).
 *
 * Caller should pass farmers from the same barangay — the function does
 * NOT filter by barangay itself, so callers can pre-filter or pass a
 * global list.
 *
 * Returns null when no duplicate is detected.
 */
export function findDuplicateFarmer(
  candidate: {
    name: string;
    rsbsa: string | null;
    /** Pass when editing — excludes self from the duplicate scan. */
    excludeId?: string | null;
  },
  farmers: Farmer[],
): FarmerDuplicateMatch | null {
  const candName = normalizeNameForCompare(candidate.name);
  const candRsbsa = candidate.rsbsa ? normalizeRsbsaForCompare(candidate.rsbsa) : "";

  if (!candName && !candRsbsa) return null;

  // RSBSA check first — a real government ID match is the stronger signal.
  if (candRsbsa) {
    for (const f of farmers) {
      if (candidate.excludeId && f.id === candidate.excludeId) continue;
      if (!f.rsbsa_number) continue;
      if (normalizeRsbsaForCompare(f.rsbsa_number) === candRsbsa) {
        return { kind: "rsbsa", farmer: f };
      }
    }
  }

  if (candName) {
    for (const f of farmers) {
      if (candidate.excludeId && f.id === candidate.excludeId) continue;
      if (normalizeNameForCompare(f.name) === candName) {
        return { kind: "name", farmer: f };
      }
    }
  }

  return null;
}

/**
 * Shape a duplicate match into a DataWarning the form can render.
 */
export function farmerDuplicateWarning(match: FarmerDuplicateMatch): DataWarning {
  if (match.kind === "rsbsa") {
    return {
      code: "duplicate_farmer_rsbsa",
      severity: "warn",
      message: `RSBSA number already used by ${match.farmer.name}. Double-check before adding.`,
      paths: ["rsbsa_number"],
    };
  }
  return {
    code: "duplicate_farmer_name",
    severity: "warn",
    message: `A farmer named ${match.farmer.name} is already registered in this barangay.`,
    paths: ["name"],
  };
}
