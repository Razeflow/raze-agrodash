"use client";

/**
 * Phase 5 / refactor step A — MetricsProvider.
 * Phase 5 / refactor step E — reads via narrow hooks now (no more prop drilling).
 *
 * Extracts every read-only summary / aggregation out of AgriDataProvider so:
 *   - consumers can subscribe via `useMetrics()` without re-rendering on raw-data churn
 *   - mutations live in AgriDataProvider; derived state lives here
 *   - the legacy `useAgriData()` facade still returns the merged shape, so no
 *     existing component breaks during the migration
 *
 * Data flow (after Phase E): MetricsProvider sits inside the three domain
 * providers (Farmers → Programs → Records → Metrics) and reads what it needs
 * via `useRecords()` / `useFarmers()` / `usePrograms()`. No props, no circular
 * imports — each context file imports types only, never the agri-context.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BARANGAYS,
  numField,
  type AgriRecord,
  type Farmer,
  type OrgType,
} from "@/lib/data";
import { useFarmers } from "./farmers-context";
import { usePrograms } from "./programs-context";
import { useRecords } from "./records-context";
import {
  getCapacitySummary,
  getCropMetrics,
  getDamageMetrics,
  getDamageSummary,
  getFisheryMetrics,
  getLifecycleSummary,
  getLivestockMetrics,
  getProductionByCommodity,
  getTopCommodity,
  recordGroup,
  recordStatus,
  type CapacitySummary,
  type LifecycleSummary,
} from "@/lib/domain/metrics";
import { isHistoricalOnly } from "@/lib/domain/lifecycle";
import { sortBy } from "@/lib/sort";
import { fullNameSortKey, lastNameSortKey } from "@/lib/name";

export type MetricsContextValue = {
  farmersByBarangay: Record<string, Farmer[]>;
  organizationStats: { id: string; name: string; org_type: OrgType; memberCount: number }[];
  uniqueFarmersInOrganizations: number;
  totalFarmers: { male: number; female: number; total: number };
  totalProduction: { cropBags: number; cropTons: number; fisheryPieces: number; livestockHeads: number };
  totalPlantingArea: number;
  totalDamagedArea: number;
  mostProducedCommodity: string;
  productionByCommodity: { name: string; bags: number; tons: number }[];
  productionBySubCategory: { name: string; commodity: string; bags: number; tons: number }[];
  farmersByCommodity: { name: string; male: number; female: number; total: number }[];
  damageRiskData: AgriRecord[];
  damageByCommodity: { name: string; area: number }[];
  damageByBarangay: Record<string, number>;
  mostAffectedBarangay: string;
  damagePercentage: number;
  affectedFarmerCount: number;
  damageTrend: "increasing" | "decreasing" | "stable";
  lifecycleSummary: LifecycleSummary;
  capacitySummary: CapacitySummary;
  recordsByDate: Record<string, AgriRecord[]>;
  staleBarangays: { name: string; daysSinceUpdate: number | null; lastUpdate: string | null }[];
};

const MetricsContext = createContext<MetricsContextValue | null>(null);

export function MetricsProvider({ children }: { children: ReactNode }) {
  // Phase E: pull domain slices via the narrow hooks instead of props.
  const { farmers: vf, farmerOrganizations } = useFarmers();
  const { households: vh, organizations: vo } = usePrograms();
  const { records: vr } = useRecords();
  // ── Farmer-side aggregations ──────────────────────────────────────────────
  const vfIds = useMemo(() => new Set(vf.map((f) => f.id)), [vf]);

  const farmersByBarangay = useMemo(() => {
    const map: Record<string, Farmer[]> = {};
    BARANGAYS.forEach((b) => {
      map[b] = [];
    });
    vf.forEach((f) => {
      if (map[f.barangay]) map[f.barangay].push(f);
    });
    BARANGAYS.forEach((b) => {
      map[b] = sortBy(map[b], (x) => lastNameSortKey(x.name) || fullNameSortKey(x.name));
    });
    return map;
  }, [vf]);

  const totalFarmers = useMemo(() => {
    const male = vf.filter((f) => f.gender === "Male").length;
    const female = vf.filter((f) => f.gender === "Female").length;
    return { male, female, total: vf.length };
  }, [vf]);

  const organizationStats = useMemo(() => {
    const counts = new Map<string, number>();
    farmerOrganizations.forEach(({ farmer_id, organization_id }) => {
      if (vfIds.has(farmer_id)) {
        counts.set(organization_id, (counts.get(organization_id) || 0) + 1);
      }
    });
    return sortBy(
      vo.map((org) => ({
        id: org.id,
        name: org.name,
        org_type: org.org_type,
        memberCount: counts.get(org.id) || 0,
      })),
      (o) => o.name,
    );
  }, [farmerOrganizations, vfIds, vo]);

  const uniqueFarmersInOrganizations = useMemo(() => {
    const ids = new Set<string>();
    farmerOrganizations.forEach(({ farmer_id }) => {
      if (vfIds.has(farmer_id)) ids.add(farmer_id);
    });
    return ids.size;
  }, [farmerOrganizations, vfIds]);

  // ── Production / KPI aggregations (Phase 4, delegating to lib/domain) ────
  const totalProduction = useMemo(() => {
    const crop = getCropMetrics(vr as any);
    const fishery = getFisheryMetrics(vr as any);
    const livestock = getLivestockMetrics(vr as any);
    return {
      cropBags: crop.harvestedBags,
      cropTons: crop.harvestedMetricTons,
      fisheryPieces: fishery.harvestedPieces,
      livestockHeads: livestock.outputHeads,
    };
  }, [vr]);

  const totalPlantingArea = useMemo(
    () =>
      +vr
        .filter((r) => recordGroup(r as any) === "CROP" && recordStatus(r as any) === "active")
        .reduce((s, r) => s + numField(r.planting_area_hectares), 0)
        .toFixed(2),
    [vr],
  );

  const totalDamagedArea = useMemo(() => getDamageMetrics(vr as any).cropInSeasonDamageHa, [vr]);

  const mostProducedCommodity = useMemo(() => getTopCommodity(vr as any), [vr]);

  const productionByCommodity = useMemo(
    () =>
      getProductionByCommodity(vr as any, "CROP").map((row) => ({
        name: row.name,
        bags: row.value,
        tons: +(row.value * 0.04).toFixed(2),
      })),
    [vr],
  );

  const productionBySubCategory = useMemo(() => {
    const t: Record<string, { commodity: string; bags: number }> = {};
    vr.forEach((r) => {
      if (recordGroup(r as any) !== "CROP") return;
      if (recordStatus(r as any) !== "harvested") return;
      if (!t[r.sub_category]) t[r.sub_category] = { commodity: r.commodity, bags: 0 };
      t[r.sub_category].bags += numField(r.harvesting_output_bags);
    });
    return Object.entries(t).map(([name, v]) => ({
      name,
      ...v,
      tons: +(v.bags * 0.04).toFixed(2),
    }));
  }, [vr]);

  const farmersByCommodity = useMemo(() => {
    const t: Record<string, { male: number; female: number; total: number }> = {};
    vr.forEach((r) => {
      if (!t[r.commodity]) t[r.commodity] = { male: 0, female: 0, total: 0 };
      t[r.commodity].male += r.farmer_male;
      t[r.commodity].female += r.farmer_female;
      t[r.commodity].total += r.total_farmers;
    });
    return Object.entries(t).map(([name, v]) => ({ name, ...v }));
  }, [vr]);

  // ── Damage / risk + lifecycle + capacity ─────────────────────────────────
  const damageSummary = useMemo(() => getDamageSummary(vr as any), [vr]);
  const lifecycleSummary = useMemo(() => getLifecycleSummary(vr as any), [vr]);
  const capacitySummary = useMemo(() => getCapacitySummary(vr as any, vh, vf), [vr, vh, vf]);

  const damageRiskData = useMemo(
    () =>
      vr
        .filter((r) => !isHistoricalOnly(recordStatus(r as any)))
        .filter((r) => {
          const g = recordGroup(r as any);
          if (g === "CROP") {
            if (numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares) > 0) return true;
          }
          if (g === "FISHERY" && recordStatus(r as any) === "damaged" && numField(r.fishery_loss_pieces) > 0) return true;
          if (g === "LIVESTOCK" && recordStatus(r as any) === "damaged" && numField(r.livestock_dead_heads) > 0) return true;
          return r.pests_diseases !== "None" || r.calamity !== "None" || r.calamity_sub_category !== "None";
        })
        .sort(
          (a, b) =>
            numField(b.damage_pests_hectares) +
            numField(b.damage_calamity_hectares) -
            (numField(a.damage_pests_hectares) + numField(a.damage_calamity_hectares)),
        ),
    [vr],
  );

  const damageByCommodity = useMemo(
    () => damageSummary.crop.byCommodity.map(({ name, damageHa }) => ({ name, area: damageHa })),
    [damageSummary],
  );
  const damageByBarangay = useMemo(() => damageSummary.crop.byBarangay, [damageSummary]);
  const mostAffectedBarangay = useMemo(() => damageSummary.crop.mostAffected ?? "None", [damageSummary]);
  const damagePercentage = useMemo(() => damageSummary.crop.damagePctOfActive, [damageSummary]);
  const affectedFarmerCount = useMemo(() => damageSummary.crop.affectedFarmers, [damageSummary]);
  const damageTrend = useMemo<"increasing" | "decreasing" | "stable">(
    () => damageSummary.crop.trend,
    [damageSummary],
  );

  // ── Date-keyed / staleness views ─────────────────────────────────────────
  const recordsByDate = useMemo(() => {
    const map: Record<string, AgriRecord[]> = {};
    vr.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      if (!map[day]) map[day] = [];
      map[day].push(r);
    });
    return map;
  }, [vr]);

  const [staleTimestamp, setStaleTimestamp] = useState(() => Date.now());
  useEffect(() => {
    setStaleTimestamp(Date.now());
  }, [vr]);

  const staleBarangays = useMemo(() => {
    return BARANGAYS.map((name) => {
      const br = vr.filter((r) => r.barangay === name);
      if (br.length === 0) return { name, daysSinceUpdate: null, lastUpdate: null };
      const latest = br.reduce((max, r) => (r.created_at > max ? r.created_at : max), "");
      return {
        name,
        daysSinceUpdate: Math.floor((staleTimestamp - new Date(latest).getTime()) / 86_400_000),
        lastUpdate: latest.slice(0, 10),
      };
    });
  }, [vr, staleTimestamp]);

  const value: MetricsContextValue = useMemo(
    () => ({
      farmersByBarangay,
      organizationStats,
      uniqueFarmersInOrganizations,
      totalFarmers,
      totalProduction,
      totalPlantingArea,
      totalDamagedArea,
      mostProducedCommodity,
      productionByCommodity,
      productionBySubCategory,
      farmersByCommodity,
      damageRiskData,
      damageByCommodity,
      damageByBarangay,
      mostAffectedBarangay,
      damagePercentage,
      affectedFarmerCount,
      damageTrend,
      lifecycleSummary,
      capacitySummary,
      recordsByDate,
      staleBarangays,
    }),
    [
      farmersByBarangay,
      organizationStats,
      uniqueFarmersInOrganizations,
      totalFarmers,
      totalProduction,
      totalPlantingArea,
      totalDamagedArea,
      mostProducedCommodity,
      productionByCommodity,
      productionBySubCategory,
      farmersByCommodity,
      damageRiskData,
      damageByCommodity,
      damageByBarangay,
      mostAffectedBarangay,
      damagePercentage,
      affectedFarmerCount,
      damageTrend,
      lifecycleSummary,
      capacitySummary,
      recordsByDate,
      staleBarangays,
    ],
  );

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}

/** New, opt-in hook — components reading only summaries should prefer this over `useAgriData()`. */
export function useMetrics(): MetricsContextValue {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error("useMetrics must be used within MetricsProvider");
  return ctx;
}

/** Internal: consumed by `useAgriData()` facade so it can merge metrics into the legacy shape. */
export { MetricsContext };
