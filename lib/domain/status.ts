import type { LifecycleStatus } from "@/lib/data";

export type RecordStatus = "active" | "harvested" | "damaged" | "archived";

export const RECORD_STATUSES: RecordStatus[] = ["active", "harvested", "damaged", "archived"];

/** Display labels for the new lifecycle. Used by form dropdown, badges, table chips. */
export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  active: "Active",
  harvested: "Harvested",
  damaged: "Damaged",
  archived: "Archived",
};

/** One-line hint shown under the form dropdown to explain each state. */
export const RECORD_STATUS_DESCRIPTIONS: Record<RecordStatus, string> = {
  active: "Ongoing cycle. Area/stocking required; harvest must stay 0 until you finalize.",
  harvested: "Final harvest captured. Counts toward official production totals.",
  damaged: "Finalized loss. Counts toward damage reports; harvest must be 0.",
  archived: "Locked historical record — read-only. Cannot transition out.",
};

/** Tailwind class set per status for chip/badge rendering. */
export const RECORD_STATUS_CHIP_STYLES: Record<RecordStatus, string> = {
  active: "bg-sky-50 text-sky-700",
  harvested: "bg-emerald-50 text-emerald-700",
  damaged: "bg-red-50 text-red-700",
  archived: "bg-slate-100 text-slate-600",
};

export function isFinalizedStatus(s: RecordStatus): boolean {
  return s === "harvested" || s === "damaged";
}

export function isActiveStatus(s: RecordStatus): boolean {
  return s === "active";
}

/**
 * Allowed status transitions per the Phase 1 spec state diagram:
 *   active     → harvested  (finalize successful harvest)
 *   active     → damaged    (finalize loss)
 *   harvested  → archived   (lock historical record)
 *   damaged    → archived   (lock historical record)
 *
 * Self-transitions (e.g. active → active) are allowed so no-op edits
 * never fail. Archived rows are read-only — no transitions out.
 */
const ALLOWED_TRANSITIONS: Record<RecordStatus, ReadonlySet<RecordStatus>> = {
  active: new Set<RecordStatus>(["active", "harvested", "damaged"]),
  harvested: new Set<RecordStatus>(["harvested", "archived"]),
  damaged: new Set<RecordStatus>(["damaged", "archived"]),
  archived: new Set<RecordStatus>(["archived"]),
};

export function canTransition(from: RecordStatus, to: RecordStatus): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

/**
 * Backward compatibility mapper from the legacy lifecycle_status column.
 * Legacy:
 * - planted, damaged (mid-season) => active
 * - harvested => harvested
 * - total_loss => damaged
 */
export function recordStatusFromLifecycleStatus(s: LifecycleStatus): RecordStatus {
  if (s === "harvested") return "harvested";
  if (s === "total_loss") return "damaged";
  return "active";
}

