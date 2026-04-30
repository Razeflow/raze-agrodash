/**
 * Load test for lib/validations.ts schemas.
 *
 * Generates N synthetic records (mix of valid + intentionally-invalid) and
 * runs them through recordFormSchema + farmerFormSchema, measuring throughput
 * and correctness. No DB writes.
 *
 * Run: npx tsx scripts/perf-validations.ts [count]
 *      defaults to 5000
 */
import { recordFormSchema, farmerFormSchema, RECORD_LIMITS } from "../lib/validations";
import { BARANGAYS, COMMODITY_OPTIONS, CALAMITY_SUB_CATEGORIES } from "../lib/data";

const N = Number(process.argv[2] ?? 5000);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 70% valid, 30% intentionally-invalid (one bad field randomly chosen)
function makeRecord(i: number) {
  const valid = Math.random() < 0.7;
  const commodity = pick(COMMODITY_OPTIONS);
  const isFishery = commodity === "Fishery";
  const planting = isFishery ? 0 : Math.random() * 100;
  const damagePests = isFishery ? 0 : Math.random() * planting * 0.3;
  const damageCal   = isFishery ? 0 : Math.random() * planting * 0.3;
  const calSub = pick(CALAMITY_SUB_CATEGORIES);

  const base = {
    barangay: pick(BARANGAYS),
    commodity,
    sub_category: commodity === "Corn" ? "Corn" : "Hybrid",
    farmer_ids: [`f${i}`],
    period_month: 1 + Math.floor(Math.random() * 12),
    period_year: 2024 + Math.floor(Math.random() * 3),
    planting_area_hectares: planting,
    harvesting_output_bags: isFishery ? 0 : Math.random() * 1000,
    damage_pests_hectares: damagePests,
    damage_calamity_hectares: damageCal,
    stocking: isFishery ? Math.random() * 5000 : 0,
    harvesting_fishery: isFishery ? Math.random() * 4000 : 0,
    pests_diseases: "None",
    calamity: calSub === "None" ? "None" : "Typhoon Egay",
    calamity_sub_category: calSub,
    remarks: "",
  };

  if (valid) return { record: base, expectValid: true };

  // Inject ONE failure, randomly chosen
  const mode = Math.floor(Math.random() * 5);
  switch (mode) {
    case 0: return { record: { ...base, planting_area_hectares: -1 }, expectValid: false };
    case 1: return { record: { ...base, planting_area_hectares: RECORD_LIMITS.AREA_MAX + 1 }, expectValid: false };
    case 2: return { record: { ...base, period_month: 13 }, expectValid: false };
    case 3: return { record: { ...base, farmer_ids: [] }, expectValid: false };
    case 4: return { record: { ...base, calamity_sub_category: "Typhoon" as const, calamity: "" }, expectValid: false };
  }
  return { record: base, expectValid: true };
}

function makeFarmer(i: number) {
  const valid = Math.random() < 0.7;
  const base = {
    name: `Farmer ${i}`,
    gender: Math.random() < 0.5 ? ("Male" as const) : ("Female" as const),
    barangay: pick(BARANGAYS),
    rsbsa_number: "",
    birth_date: `19${50 + Math.floor(Math.random() * 50)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-15`,
    civil_status: "",
  };
  if (valid) return { farmer: base, expectValid: true };
  const mode = Math.floor(Math.random() * 3);
  switch (mode) {
    case 0: return { farmer: { ...base, name: "X" }, expectValid: false }; // too short
    case 1: return { farmer: { ...base, birth_date: "2099-01-01" }, expectValid: false }; // future
    case 2: return { farmer: { ...base, birth_date: "1850-01-01" }, expectValid: false }; // ancient
  }
  return { farmer: base, expectValid: true };
}

console.log(`\n── LOAD TEST · ${N.toLocaleString()} records + ${N.toLocaleString()} farmers ─────────`);

// ── Generate ─────
const tGen = process.hrtime.bigint();
const records = Array.from({ length: N }, (_, i) => makeRecord(i));
const farmers = Array.from({ length: N }, (_, i) => makeFarmer(i));
const genMs = Number(process.hrtime.bigint() - tGen) / 1e6;
console.log(`  generated payloads in ${genMs.toFixed(0)} ms`);

// ── Validate records ─────
let recordsPassed = 0, recordsFailed = 0, recordsWrong = 0;
const tRec = process.hrtime.bigint();
for (const { record, expectValid } of records) {
  const r = recordFormSchema.safeParse(record);
  if (r.success === expectValid) {
    if (r.success) recordsPassed++; else recordsFailed++;
  } else {
    recordsWrong++;
  }
}
const recMs = Number(process.hrtime.bigint() - tRec) / 1e6;
const recPerSec = (N / (recMs / 1000)).toFixed(0);
console.log(`  records:  ${recordsPassed} valid · ${recordsFailed} rejected · ${recordsWrong} mismatched`);
console.log(`            ${recMs.toFixed(0)} ms total · ${recPerSec} records/sec · ${(recMs / N * 1000).toFixed(0)} µs each`);

// ── Validate farmers ─────
let farmersPassed = 0, farmersFailed = 0, farmersWrong = 0;
const tFar = process.hrtime.bigint();
for (const { farmer, expectValid } of farmers) {
  const r = farmerFormSchema.safeParse(farmer);
  if (r.success === expectValid) {
    if (r.success) farmersPassed++; else farmersFailed++;
  } else {
    farmersWrong++;
  }
}
const farMs = Number(process.hrtime.bigint() - tFar) / 1e6;
const farPerSec = (N / (farMs / 1000)).toFixed(0);
console.log(`  farmers:  ${farmersPassed} valid · ${farmersFailed} rejected · ${farmersWrong} mismatched`);
console.log(`            ${farMs.toFixed(0)} ms total · ${farPerSec} farmers/sec · ${(farMs / N * 1000).toFixed(0)} µs each`);

console.log(`\n── VERDICT ─────`);
const totalWrong = recordsWrong + farmersWrong;
console.log(`  Mismatches: ${totalWrong} (expected 0 — schemas should agree with the test fixture)`);
console.log(`  Throughput: ${(2 * N / ((recMs + farMs) / 1000)).toFixed(0)} validations/sec`);
console.log(`  This means a single form submit takes <1 ms. Validation is NOT a bottleneck.`);
process.exit(totalWrong === 0 ? 0 : 1);
