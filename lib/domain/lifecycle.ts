import type { CommodityGroup } from "./commodity";
import type { RecordStatus } from "./status";

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

const ALLOWED_TRANSITIONS: Record<RecordStatus, ReadonlySet<RecordStatus>> = {
  active: new Set<RecordStatus>(["active", "harvested", "damaged"]),
  harvested: new Set<RecordStatus>(["harvested", "archived"]),
  damaged: new Set<RecordStatus>(["damaged", "archived"]),
  archived: new Set<RecordStatus>(["archived"]),
};

export function isFinalizedRecord(s: RecordStatus): boolean {
  return s === "harvested" || s === "damaged";
}

export function isReadOnlyRecord(s: RecordStatus): boolean {
  return s === "archived";
}

/**
 * Phase 4 lifecycle predicates — the canonical answer to "should this row be
 * counted in this aggregator?". Aggregators MUST call these instead of doing
 * their own `s === "harvested"` checks so reporting stays consistent.
 *
 * Rules (from the Phase 4 spec):
 * - active     → consumes household allocation; never counts toward finalized output
 * - harvested  → counts toward official production
 * - damaged    → counts toward damage analytics; never counts toward production
 * - archived   → historical only; excluded from every aggregator
 */
export function countsTowardFinalizedProduction(s: RecordStatus): boolean {
  return s === "harvested";
}

export function countsTowardDamageReports(s: RecordStatus): boolean {
  return s === "damaged";
}

export function consumesActiveAllocation(s: RecordStatus): boolean {
  return s === "active";
}

export function isHistoricalOnly(s: RecordStatus): boolean {
  return s === "archived";
}

export function canTransitionStatus(from: RecordStatus, to: RecordStatus): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

/**
 * Lifecycle enforcement needs numeric evidence:
 * - harvested: requires output > 0
 * - damaged: requires significant/full loss; no finalized output
 * - active: should not count toward finalized production
 * - archived: read-only
 */
export function validateStatusEvidence(input: {
  group: CommodityGroup;
  status: RecordStatus;
  baseSize: number;
  output: number;
  loss: number;
}): TransitionResult {
  const base = Number.isFinite(input.baseSize) ? input.baseSize : 0;
  const out = Number.isFinite(input.output) ? input.output : 0;
  const loss = Number.isFinite(input.loss) ? input.loss : 0;

  if (input.status === "harvested") {
    if (out <= 0) return { ok: false, reason: "HARVESTED requires output > 0." };
    if (loss < 0) return { ok: false, reason: "Loss cannot be negative." };
    return { ok: true };
  }

  if (input.status === "damaged") {
    if (out > 0) return { ok: false, reason: "DAMAGED must not have a finalized output." };
    if (loss <= 0) return { ok: false, reason: "DAMAGED requires loss > 0." };
    // Conservative guard: damaged should represent a substantial loss.
    // For crops (ha) and fishery/livestock (pieces/heads), use 50% as a floor.
    if (base > 0 && loss < base * 0.5) {
      return { ok: false, reason: "DAMAGED requires significant loss (≥ 50% of base size)." };
    }
    return { ok: true };
  }

  if (input.status === "archived") {
    return { ok: true };
  }

  // active
  if (out > 0) return { ok: false, reason: "ACTIVE cannot have a finalized output; set status to HARVESTED." };
  return { ok: true };
}

export function isDamageExceedingProduction(input: { baseSize: number; loss: number }): boolean {
  const base = Number.isFinite(input.baseSize) ? input.baseSize : 0;
  const loss = Number.isFinite(input.loss) ? input.loss : 0;
  return base > 0 && loss > base + 1e-6;
}

