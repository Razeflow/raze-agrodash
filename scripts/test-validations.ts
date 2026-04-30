/**
 * Smoke test for lib/validations.ts schemas.
 * Runs each scenario from the Sub-plan 1 test plan and asserts pass/fail.
 *
 * Run: npx tsx scripts/test-validations.ts
 */
import { recordFormSchema, farmerFormSchema } from "../lib/validations";

let pass = 0;
let fail = 0;

type SafeParseLike = {
  success: boolean;
  error?: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> };
};

function check(name: string, expectFail: boolean, result: SafeParseLike) {
  const ok = expectFail ? !result.success : result.success;
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
    if (expectFail && !result.success && result.error) {
      const first = result.error.issues[0];
      const pathStr = first.path.map((p) => String(p)).join(".");
      console.log(`        └─ "${pathStr}": ${first.message}`);
    }
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
    if (!result.success && result.error) {
      console.log(`        unexpected issues: ${JSON.stringify(result.error.issues)}`);
    } else if (result.success && expectFail) {
      console.log(`        expected validation to fail but it passed`);
    }
  }
}

const baseValidRecord = {
  barangay: "Supo",
  commodity: "Rice",
  sub_category: "Hybrid",
  farmer_ids: ["f1"],
  period_month: 4,
  period_year: 2026,
  planting_area_hectares: 2,
  harvesting_output_bags: 50,
  damage_pests_hectares: 0,
  damage_calamity_hectares: 0,
  stocking: 0,
  harvesting_fishery: 0,
  pests_diseases: "None",
  calamity: "None",
  calamity_sub_category: "None",
  remarks: "",
};

console.log("\n── RECORD SCHEMA ─────────────────────────────────");

check(
  "Test 1: negative planting area is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, planting_area_hectares: -5 }),
);

check(
  "Test 2: planting area > 10,000 ha is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, planting_area_hectares: 99999 }),
);

check(
  "Test 3: damage > planting area is rejected (cross-field)",
  true,
  recordFormSchema.safeParse({
    ...baseValidRecord,
    planting_area_hectares: 10,
    damage_pests_hectares: 7,
    damage_calamity_hectares: 5,
  }),
);

check(
  "Test 4: calamity type set with empty event name is rejected",
  true,
  recordFormSchema.safeParse({
    ...baseValidRecord,
    calamity_sub_category: "Typhoon",
    calamity: "",
  }),
);

check(
  "Test 4b: calamity type set WITH event name is accepted",
  false,
  recordFormSchema.safeParse({
    ...baseValidRecord,
    calamity_sub_category: "Typhoon",
    calamity: "Typhoon Egay",
  }),
);

check(
  "Test 6a: happy-path record is accepted",
  false,
  recordFormSchema.safeParse(baseValidRecord),
);

check(
  "Edge: zero farmers is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, farmer_ids: [] }),
);

check(
  "Edge: harvest bags = 1,000,001 is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, harvesting_output_bags: 1_000_001 }),
);

check(
  "Edge: period month 13 is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, period_month: 13 }),
);

check(
  "Edge: period year 2019 is rejected",
  true,
  recordFormSchema.safeParse({ ...baseValidRecord, period_year: 2019 }),
);

check(
  "Edge: Fishery commodity skips damage<=planting cross-field",
  false,
  recordFormSchema.safeParse({
    ...baseValidRecord,
    commodity: "Fishery",
    sub_category: "Tilapia",
    planting_area_hectares: 0,
    damage_pests_hectares: 0,
    damage_calamity_hectares: 0,
    stocking: 1000,
    harvesting_fishery: 800,
  }),
);

console.log("\n── FARMER SCHEMA ─────────────────────────────────");

const baseValidFarmer = {
  name: "Juan Dela Cruz",
  gender: "Male" as const,
  barangay: "Supo",
  rsbsa_number: "",
  birth_date: "",
  civil_status: "",
};

check(
  "Test 5: 1-character name is rejected",
  true,
  farmerFormSchema.safeParse({ ...baseValidFarmer, name: "J" }),
);

check(
  "Test 6b: happy-path farmer is accepted",
  false,
  farmerFormSchema.safeParse(baseValidFarmer),
);

check(
  "Edge: empty name is rejected",
  true,
  farmerFormSchema.safeParse({ ...baseValidFarmer, name: "" }),
);

check(
  "Edge: future birth date is rejected",
  true,
  farmerFormSchema.safeParse({ ...baseValidFarmer, birth_date: "2099-01-01" }),
);

check(
  "Edge: birth date in 1850 is rejected",
  true,
  farmerFormSchema.safeParse({ ...baseValidFarmer, birth_date: "1850-01-01" }),
);

check(
  "Edge: empty rsbsa + empty birth_date is accepted (optional)",
  false,
  farmerFormSchema.safeParse(baseValidFarmer),
);

check(
  "Edge: valid 1990 birth date is accepted",
  false,
  farmerFormSchema.safeParse({ ...baseValidFarmer, birth_date: "1990-06-15" }),
);

console.log(`\n── RESULT ────────────────────────────────────────`);
console.log(`  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
