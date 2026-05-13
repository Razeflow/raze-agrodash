/**
 * Smoke tests for Phase 4 reporting aggregators.
 *
 * Exercises the lifecycle invariants Phase 4 codifies:
 *   - active rows never count toward harvested totals
 *   - archived rows never contribute anywhere
 *   - damaged rows count toward damage analytics, not production
 *   - mixed-unit production is impossible (per-group helpers only)
 *   - capacity = household ha; active allocations sum correctly; remaining ha is right
 *
 * Run: npx tsx scripts/test-metrics.ts
 */
import type { AgriRecord, Farmer, Household } from "../lib/data";
import {
  getCropMetrics,
  getFisheryMetrics,
  getLivestockMetrics,
  getDamageSummary,
  getCapacitySummary,
  getLifecycleSummary,
  getProductionByCommodity,
  getRiskRanking,
} from "../lib/domain/metrics";
import {
  classifyCropDamageSeverity,
  classifyFisheryLossSeverity,
  classifyLivestockLossSeverity,
} from "../lib/domain/severity";
import {
  checkActiveExcludedFromProduction,
  checkDamageDoesNotExceedActiveArea,
  checkFinalizedProductionRowHasOutput,
  checkHouseholdCapacityNotExceeded,
  checkNoMixedUnits,
  checkFisheryNeverConvertedToMt,
  checkCropOnlyConvertsToMt,
} from "../lib/domain/invariants";

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

// ── Fixtures ───────────────────────────────────────────────────
function rec(over: Partial<AgriRecord>): AgriRecord {
  const base: AgriRecord = {
    id: over.id ?? Math.random().toString(36).slice(2),
    barangay: "Supo",
    commodity: "Rice",
    sub_category: "Hybrid",
    farmer_ids: ["f1"],
    farmer_names: "Juan",
    farmer_male: 1,
    farmer_female: 0,
    total_farmers: 1,
    planting_area_hectares: 0,
    harvesting_output_bags: 0,
    damage_pests_hectares: 0,
    damage_calamity_hectares: 0,
    stocking: 0,
    harvesting_fishery: 0,
    fishery_loss_pieces: 0,
    livestock_stocking_heads: 0,
    livestock_output_heads: 0,
    livestock_dead_heads: 0,
    pests_diseases: "None",
    calamity: "None",
    calamity_sub_category: "None",
    remarks: "",
    period_month: 5,
    period_year: 2026,
    lifecycle_status: "harvested",
    status: "harvested",
    commodity_group: "CROP",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  };
  return { ...base, ...over } as AgriRecord;
}

const farmers: Farmer[] = [
  { id: "f1", name: "Juan", gender: "Male", barangay: "Supo", household_id: "h1", is_household_head: true,
    rsbsa_number: "", birth_date: "", civil_status: "", photo_url: "", created_at: "", updated_at: "" } as Farmer,
];

const households: Household[] = [
  { id: "h1", barangay: "Supo", display_name: "Dela Cruz", farming_area_hectares: 5,
    rffa_subsidies_notes: "", organization_id: null, created_at: "", updated_at: "" },
];

// ── Test 1: lifecycle exclusion ─────────────────────────────
console.log("\n── LIFECYCLE EXCLUSION ────────────────────────────");
{
  const records = [
    rec({ id: "a", status: "active", lifecycle_status: "planted", harvesting_output_bags: 99, planting_area_hectares: 2 }),
    rec({ id: "h", status: "harvested", lifecycle_status: "harvested", harvesting_output_bags: 100, planting_area_hectares: 2 }),
    rec({ id: "d", status: "damaged", lifecycle_status: "damaged", harvesting_output_bags: 88, planting_area_hectares: 2 }),
    rec({ id: "x", status: "archived", lifecycle_status: "harvested", harvesting_output_bags: 77, planting_area_hectares: 2 }),
  ];
  const m = getCropMetrics(records);
  check("active row excluded from harvestedBags", m.harvestedBags === 100, `got ${m.harvestedBags}`);
  check("archived row excluded from harvestedBags", m.harvestedBags === 100);
  check("damaged row excluded from harvestedBags", m.harvestedBags === 100);
}

// ── Test 2: fishery & livestock metrics ────────────────────
console.log("\n── FISHERY & LIVESTOCK METRICS ───────────────────");
{
  const records = [
    rec({ commodity: "Fishery", commodity_group: "FISHERY", status: "harvested", lifecycle_status: "harvested",
      stocking: 1000, harvesting_fishery: 800 }),
    rec({ commodity: "Fishery", commodity_group: "FISHERY", status: "damaged", lifecycle_status: "damaged",
      stocking: 1000, fishery_loss_pieces: 600 }),
    rec({ commodity: "Livestock", commodity_group: "LIVESTOCK", status: "harvested", lifecycle_status: "harvested",
      livestock_stocking_heads: 50, livestock_output_heads: 40 }),
    rec({ commodity: "Livestock", commodity_group: "LIVESTOCK", status: "damaged", lifecycle_status: "damaged",
      livestock_stocking_heads: 50, livestock_dead_heads: 30 }),
  ];
  const f = getFisheryMetrics(records);
  const l = getLivestockMetrics(records);
  check("fishery harvested pieces only from harvested rows", f.harvestedPieces === 800);
  check("fishery loss pieces only from damaged rows", f.lossPieces === 600);
  check("livestock output heads only from harvested rows", l.outputHeads === 40);
  check("livestock dead heads only from damaged rows", l.deadHeads === 30);
}

// ── Test 3: lifecycle summary ──────────────────────────────
console.log("\n── LIFECYCLE SUMMARY ─────────────────────────────");
{
  const records = [
    rec({ status: "active", lifecycle_status: "planted", planting_area_hectares: 3 }),
    rec({ status: "active", lifecycle_status: "planted", planting_area_hectares: 1.5 }),
    rec({ status: "harvested", lifecycle_status: "harvested", planting_area_hectares: 2, harvesting_output_bags: 120 }),
    rec({ commodity: "Fishery", commodity_group: "FISHERY", status: "active", lifecycle_status: "planted", stocking: 500 }),
    rec({ commodity: "Livestock", commodity_group: "LIVESTOCK", status: "archived", lifecycle_status: "harvested",
      livestock_stocking_heads: 25 }),
  ];
  const s = getLifecycleSummary(records);
  check("active count is 3", s.active.count === 3, `got ${s.active.count}`);
  check("harvested count is 1", s.harvested.count === 1);
  check("archived count is 1", s.archived.count === 1);
  check("active crop area sums to 4.5", approx(s.active.cropAreaHa, 4.5), `got ${s.active.cropAreaHa}`);
  check("active fishery stocking is 500", s.active.fisheryStockingPieces === 500);
  check("archived livestock heads is 25", s.archived.livestockHeads === 25);
}

// ── Test 4: capacity summary ───────────────────────────────
console.log("\n── CAPACITY SUMMARY ──────────────────────────────");
{
  const records = [
    rec({ status: "active", lifecycle_status: "planted", planting_area_hectares: 2, farmer_ids: ["f1"] }),
    rec({ status: "active", lifecycle_status: "planted", planting_area_hectares: 1, farmer_ids: ["f1"] }),
    rec({ status: "harvested", lifecycle_status: "harvested", planting_area_hectares: 5, farmer_ids: ["f1"], harvesting_output_bags: 100 }),
  ];
  const c = getCapacitySummary(records, households, farmers);
  check("total capacity = 5", c.totalCapacityHa === 5, `got ${c.totalCapacityHa}`);
  check("active allocated = 3 (harvested released)", c.activeAllocatedHa === 3, `got ${c.activeAllocatedHa}`);
  check("remaining = 2", c.remainingHa === 2, `got ${c.remainingHa}`);
  check("utilization 60%", c.utilizationPct === 60, `got ${c.utilizationPct}`);
  check("released area = 5 (harvested row)", c.releasedAreaHa === 5, `got ${c.releasedAreaHa}`);
  check("not overallocated", c.overallocatedHouseholds === 0);
}

// ── Test 5: damage summary ─────────────────────────────────
console.log("\n── DAMAGE SUMMARY ────────────────────────────────");
{
  const records = [
    rec({ status: "active", lifecycle_status: "damaged", planting_area_hectares: 4, damage_pests_hectares: 1, damage_calamity_hectares: 0.5, total_farmers: 2 }),
    rec({ status: "damaged", lifecycle_status: "damaged", planting_area_hectares: 3, damage_pests_hectares: 0, damage_calamity_hectares: 3, total_farmers: 1 }),
    rec({ commodity: "Fishery", commodity_group: "FISHERY", status: "damaged", lifecycle_status: "damaged", stocking: 1000, fishery_loss_pieces: 600, total_farmers: 1 }),
    rec({ commodity: "Livestock", commodity_group: "LIVESTOCK", status: "damaged", lifecycle_status: "damaged", livestock_stocking_heads: 20, livestock_dead_heads: 12, total_farmers: 1 }),
    rec({ status: "archived", lifecycle_status: "harvested", planting_area_hectares: 9, damage_pests_hectares: 9, damage_calamity_hectares: 0 }),
  ];
  const d = getDamageSummary(records);
  check("crop damage ignores archived rows", approx(d.crop.damageHa, 4.5), `got ${d.crop.damageHa}`);
  check("crop finalized loss = 3 ha (one fully-damaged row)", d.crop.finalizedLossHa === 3, `got ${d.crop.finalizedLossHa}`);
  check("crop affected farmers = 3", d.crop.affectedFarmers === 3, `got ${d.crop.affectedFarmers}`);
  check("fishery loss bucket = 600", d.fishery.lossPieces === 600, `got ${d.fishery.lossPieces}`);
  check("livestock dead heads = 12", d.livestock.deadHeads === 12, `got ${d.livestock.deadHeads}`);
  check("crop most-affected resolves", d.crop.mostAffected === "Supo");
}

// ── Test 6: production by commodity (one-unit per call) ─────
console.log("\n── PRODUCTION BY COMMODITY ───────────────────────");
{
  const records = [
    rec({ commodity: "Rice", status: "harvested", lifecycle_status: "harvested", harvesting_output_bags: 100 }),
    rec({ commodity: "Corn", status: "harvested", lifecycle_status: "harvested", harvesting_output_bags: 60 }),
    rec({ commodity: "Fishery", commodity_group: "FISHERY", status: "harvested", lifecycle_status: "harvested", harvesting_fishery: 800 }),
    rec({ commodity: "Livestock", commodity_group: "LIVESTOCK", status: "harvested", lifecycle_status: "harvested", livestock_output_heads: 40 }),
  ];
  const crops = getProductionByCommodity(records, "CROP");
  const fish = getProductionByCommodity(records, "FISHERY");
  const live = getProductionByCommodity(records, "LIVESTOCK");
  check("crop returns only crop commodities", crops.every((c) => c.unit === "bags") && crops.length === 2);
  check("fishery returns only Fishery in pieces", fish.length === 1 && fish[0].unit === "pieces" && fish[0].value === 800);
  check("livestock returns only Livestock in heads", live.length === 1 && live[0].unit === "heads" && live[0].value === 40);
  check("no-mixed-units invariant holds for each call",
    checkNoMixedUnits(crops).ok && checkNoMixedUnits(fish).ok && checkNoMixedUnits(live).ok);
}

// ── Test 7: severity classifiers ──────────────────────────
console.log("\n── SEVERITY ──────────────────────────────────────");
check("crop 0 ha is LOW", classifyCropDamageSeverity(0) === "LOW");
check("crop 0.5 ha is MODERATE", classifyCropDamageSeverity(0.5) === "MODERATE");
check("crop 1.5 ha is HIGH", classifyCropDamageSeverity(1.5) === "HIGH");
check("crop 3 ha is CRITICAL", classifyCropDamageSeverity(3) === "CRITICAL");
check("fishery 50% loss is CRITICAL", classifyFisheryLossSeverity(500, 1000) === "CRITICAL");
check("fishery 25% loss is HIGH", classifyFisheryLossSeverity(250, 1000) === "HIGH");
check("fishery 10% loss is MODERATE", classifyFisheryLossSeverity(100, 1000) === "MODERATE");
check("livestock 50% loss is CRITICAL", classifyLivestockLossSeverity(25, 50) === "CRITICAL");
check("livestock no stocking falls back to absolute", classifyLivestockLossSeverity(11, 0) === "HIGH");

// ── Test 8: invariants ────────────────────────────────────
console.log("\n── INVARIANTS ────────────────────────────────────");
{
  const recs = [
    rec({ status: "harvested", lifecycle_status: "harvested", harvesting_output_bags: 100 }),
    rec({ status: "active", lifecycle_status: "planted", harvesting_output_bags: 99 }),
  ];
  check("active excluded invariant passes for correct totals",
    checkActiveExcludedFromProduction(recs, { harvestedBags: 100 }).ok);
  check("active excluded invariant catches bag inflation",
    checkActiveExcludedFromProduction(recs, { harvestedBags: 199 }).ok === false);
  check("finalized row with output passes",
    checkFinalizedProductionRowHasOutput(recs[0]).ok);
  check("finalized row with zero output fails",
    checkFinalizedProductionRowHasOutput(rec({ status: "harvested", harvesting_output_bags: 0 })).ok === false);
  check("damage > planted fails",
    checkDamageDoesNotExceedActiveArea(rec({ planting_area_hectares: 1, damage_pests_hectares: 2 })).ok === false);
  check("damage <= planted passes",
    checkDamageDoesNotExceedActiveArea(rec({ planting_area_hectares: 5, damage_pests_hectares: 2, damage_calamity_hectares: 1 })).ok);
  check("household capacity check passes",
    checkHouseholdCapacityNotExceeded(households[0], [
      rec({ status: "active", planting_area_hectares: 3, farmer_ids: ["f1"] }),
    ], farmers).ok);
  check("household capacity check catches overallocation",
    checkHouseholdCapacityNotExceeded(households[0], [
      rec({ status: "active", planting_area_hectares: 6, farmer_ids: ["f1"] }),
    ], farmers).ok === false);
  check("no mixed units passes for single-unit list",
    checkNoMixedUnits([{ unit: "bags" }, { unit: "bags" }]).ok);
  check("no mixed units fails for mixed list",
    checkNoMixedUnits([{ unit: "bags" }, { unit: "pieces" }]).ok === false);
  check("fishery never converted to MT passes",
    checkFisheryNeverConvertedToMt([{ unit: "pieces", group: "FISHERY" }]).ok);
  check("fishery never converted to MT fails",
    checkFisheryNeverConvertedToMt([{ unit: "mt", group: "FISHERY" }]).ok === false);
  check("crop only converts to MT passes",
    checkCropOnlyConvertsToMt({ unit: "mt", group: "CROP" }).ok);
  check("non-crop MT fails",
    checkCropOnlyConvertsToMt({ unit: "mt", group: "FISHERY" }).ok === false);
}

// ── Test 9: risk ranking ─────────────────────────────────
console.log("\n── RISK RANKING ─────────────────────────────────");
{
  const records = [
    rec({ barangay: "Supo", planting_area_hectares: 5, damage_pests_hectares: 3 }),
    rec({ barangay: "Other", commodity: "Fishery", commodity_group: "FISHERY", status: "damaged", lifecycle_status: "damaged",
      stocking: 1000, fishery_loss_pieces: 700 }),
    rec({ barangay: "Quiet", planting_area_hectares: 2 }),
  ];
  const ranking = getRiskRanking(records, ["Supo", "Other", "Quiet"]);
  check("ranked by severity desc", ranking[0].severity === "CRITICAL" && ranking[ranking.length - 1].severity === "LOW");
  check("Quiet barangay is LOW", ranking.find((r) => r.barangay === "Quiet")?.severity === "LOW");
}

console.log(`\n── RESULT ────────────────────────────────────────`);
console.log(`  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
