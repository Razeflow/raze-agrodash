/**
 * Phase 4 lightweight observability for aggregations.
 *
 * Intentionally framework-free so the same helpers work in browser, server,
 * and `tsx` scripts. No external deps; toggled by `NEXT_PUBLIC_DEBUG_METRICS`.
 */
import type { RecordStatus } from "./status";
import type { CommodityGroup } from "./commodity";

export type AggregationMeta = {
  /** Stable label for the aggregator (e.g. "getCropMetrics"). */
  label: string;
  /** ISO timestamp the aggregation finished. */
  generatedAt: string;
  /** Number of records that passed the input filter. */
  recordsConsidered: number;
  /** Filter that produced the slice, if any. */
  filter?: Record<string, unknown> | undefined;
  /** Status histogram for fast visual cross-checking. */
  statusCounts?: Partial<Record<RecordStatus, number>>;
  /** Group histogram. */
  groupCounts?: Partial<Record<CommodityGroup, number>>;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
};

export type WithMeta<T> = T & { __meta?: AggregationMeta };

function debugEnabled(): boolean {
  // Browser: Next inlines NEXT_PUBLIC_* at build time. Node/scripts also see it.
  try {
    return typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_METRICS === "1";
  } catch {
    return false;
  }
}

/** Shallow status/group histogram for an array of records. */
export function summarizeRecordStatuses<T extends { status?: RecordStatus | null }>(
  records: T[],
  statusFn: (r: T) => RecordStatus,
): Partial<Record<RecordStatus, number>> {
  const out: Partial<Record<RecordStatus, number>> = {};
  for (const r of records) {
    const s = statusFn(r);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

export function summarizeRecordGroups<T>(
  records: T[],
  groupFn: (r: T) => CommodityGroup,
): Partial<Record<CommodityGroup, number>> {
  const out: Partial<Record<CommodityGroup, number>> = {};
  for (const r of records) {
    const g = groupFn(r);
    out[g] = (out[g] ?? 0) + 1;
  }
  return out;
}

/**
 * Wrap an aggregation in a labeled trace. Cheap when the debug flag is off
 * (just a function call + return); verbose when enabled (console.debug + meta).
 */
export function traceAggregation<T>(label: string, recordsConsidered: number, fn: () => T, extra?: Partial<AggregationMeta>): WithMeta<T> {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const out = fn();
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const meta: AggregationMeta = {
    label,
    generatedAt: new Date().toISOString(),
    recordsConsidered,
    durationMs: +(end - start).toFixed(3),
    ...extra,
  };

  if (debugEnabled()) {
    // eslint-disable-next-line no-console
    console.debug(`[metrics] ${label}`, { meta, output: out });
  }

  if (out && typeof out === "object") {
    try {
      Object.defineProperty(out as object, "__meta", { value: meta, enumerable: false, configurable: true });
    } catch {
      // Frozen objects: meta is best-effort, never throw on observability path.
    }
  }
  return out as WithMeta<T>;
}

/** Read the meta stamp written by `traceAggregation`, if any. */
export function getAggregationMeta(value: unknown): AggregationMeta | undefined {
  if (value && typeof value === "object" && "__meta" in value) {
    return (value as { __meta?: AggregationMeta }).__meta;
  }
  return undefined;
}

/** Format a meta stamp for the print/export footer. */
export function formatAggregationMeta(meta: AggregationMeta | undefined): string {
  if (!meta) return "";
  return `${meta.label} · ${meta.recordsConsidered} record(s) · ${meta.durationMs.toFixed(1)} ms · ${meta.generatedAt}`;
}
