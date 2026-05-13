/**
 * Phase 4 severity classifiers.
 *
 * Each commodity group expresses damage in its own unit (ha / pieces / heads),
 * so a single threshold table cannot work. Centralizing the rules here keeps
 * dashboard tiles, print reports, and exports in agreement on what counts as
 * MODERATE vs HIGH vs CRITICAL.
 */
export type DamageSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export const SEVERITY_ORDER: DamageSeverity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export const SEVERITY_LABELS: Record<DamageSeverity, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** Tailwind chip styles, mirroring the existing dashboard palette. */
export const SEVERITY_CHIP_STYLES: Record<DamageSeverity, string> = {
  LOW: "bg-slate-100 text-slate-400",
  MODERATE: "bg-yellow-100 text-yellow-600",
  HIGH: "bg-orange-100 text-orange-500",
  CRITICAL: "bg-red-100 text-red-600",
};

/** Crop damage in hectares — matches the historical thresholds in DamageRiskMonitoring. */
export function classifyCropDamageSeverity(ha: number): DamageSeverity {
  const v = Number.isFinite(ha) ? ha : 0;
  if (v >= 2) return "CRITICAL";
  if (v >= 1) return "HIGH";
  if (v > 0) return "MODERATE";
  return "LOW";
}

/**
 * Fishery loss — proportional to stocking when known, otherwise absolute count.
 * Thresholds picked to mirror crop semantics: "lost half the pond" is CRITICAL.
 */
export function classifyFisheryLossSeverity(lossPieces: number, stockingPieces: number): DamageSeverity {
  const loss = Number.isFinite(lossPieces) && lossPieces > 0 ? lossPieces : 0;
  const stock = Number.isFinite(stockingPieces) && stockingPieces > 0 ? stockingPieces : 0;
  if (loss <= 0) return "LOW";

  if (stock > 0) {
    const pct = loss / stock;
    if (pct >= 0.5) return "CRITICAL";
    if (pct >= 0.25) return "HIGH";
    if (pct > 0) return "MODERATE";
    return "LOW";
  }

  // No stocking baseline — fall back to absolute counts.
  if (loss >= 2_000) return "CRITICAL";
  if (loss >= 500) return "HIGH";
  return "MODERATE";
}

/** Livestock dead heads — proportional to stocking when known. */
export function classifyLivestockLossSeverity(deadHeads: number, stockingHeads: number): DamageSeverity {
  const dead = Number.isFinite(deadHeads) && deadHeads > 0 ? deadHeads : 0;
  const stock = Number.isFinite(stockingHeads) && stockingHeads > 0 ? stockingHeads : 0;
  if (dead <= 0) return "LOW";

  if (stock > 0) {
    const pct = dead / stock;
    if (pct >= 0.5) return "CRITICAL";
    if (pct >= 0.25) return "HIGH";
    if (pct > 0) return "MODERATE";
    return "LOW";
  }

  if (dead >= 50) return "CRITICAL";
  if (dead >= 10) return "HIGH";
  return "MODERATE";
}

/** Higher = worse. Used to sort or pick the worst severity across groups. */
export function severityRank(s: DamageSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export function maxSeverity(...severities: DamageSeverity[]): DamageSeverity {
  if (severities.length === 0) return "LOW";
  return severities.reduce((worst, s) => (severityRank(s) > severityRank(worst) ? s : worst), "LOW");
}
