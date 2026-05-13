export type Unit = "ha" | "bags" | "pieces" | "heads" | "mt";

export type Quantity = {
  value: number;
  unit: Unit;
};

/**
 * Canonical crop conversion: 1 bag = 40 kg = 0.04 metric tons.
 * Intentionally *no* converters for fishery pieces or livestock heads to weight.
 */
export const CROP_BAG_TO_METRIC_TON = 0.04;

export function cropBagsToMetricTons(bags: number): number {
  return +(bags * CROP_BAG_TO_METRIC_TON).toFixed(2);
}

export function formatQuantity(q: Quantity, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (q.unit === "ha" || q.unit === "mt" ? 2 : 0);
  const v =
    decimals === 0
      ? Math.round(q.value).toLocaleString()
      : q.value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v} ${q.unit}`;
}

export function ensureNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

