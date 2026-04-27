import type { AgriRecord, Farmer, CalamitySubCategory, Organization, Household, HouseholdSubsidy, OrgType, SubsidyCategory } from "./data";
import { BARANGAYS, SUB_TYPES, CALAMITY_SUB_CATEGORIES } from "./data";

const CALAMITY_SUBS_SEED = CALAMITY_SUB_CATEGORIES.filter((c) => c !== "None") as CalamitySubCategory[];

const RECORDS_KEY = "agridash-records";
const FARMERS_KEY = "agridash-farmers";
const HOUSEHOLDS_KEY = "agridash-households";
const ORGANIZATIONS_KEY = "agridash-organizations";
const SUBSIDIES_KEY = "agridash-subsidies";

// ── Filipino name pools ───────────────────────────────────────────────────────
const MALE_FIRST = [
  "Juan", "Pedro", "Jose", "Ricardo", "Manuel", "Eduardo", "Antonio",
  "Roberto", "Fernando", "Miguel", "Carlos", "Rafael", "Ramon", "Ernesto",
  "Danilo", "Romeo", "Benjamin", "Alfredo", "Reynaldo", "Domingo",
  "Leonardo", "Francisco", "Armando", "Vicente", "Rolando",
];
const FEMALE_FIRST = [
  "Maria", "Rosa", "Elena", "Josefa", "Luz", "Carmen", "Lourdes",
  "Esperanza", "Rosita", "Gloria", "Teresa", "Norma", "Fe", "Pilar",
  "Leticia", "Corazon", "Remedios", "Soledad", "Milagros", "Beatriz",
  "Ana", "Isabel", "Patricia", "Lorna", "Evangeline",
];
const LAST_NAMES = [
  "Dela Cruz", "Santos", "Garcia", "Reyes", "Mendoza", "Ramos",
  "Torres", "Flores", "Bautista", "Gonzales", "Lopez", "Villanueva",
  "Aquino", "Castillo", "Rivera", "Domingo", "Navarro", "Salazar",
  "Pascual", "Valdez", "Aguilar", "Soriano", "Magsaysay", "Espino",
  "Corpuz",
];

const PESTS = ["Rice Blast", "Stem Borer", "Rice Bug", "Brown Planthopper", "Corn Borer", "Fall Armyworm", "Aphids", "Leaf Folder"];
const CALAMITIES = ["Typhoon Egay", "Flooding", "Drought", "Landslide", "Typhoon Carina", "None"];

const ORG_SUFFIXES_COOP = ["Farmers Cooperative", "Agricultural Cooperative", "Multi-Purpose Cooperative"];
const ORG_SUFFIXES_ASSOC = ["Farmers Association", "Agricultural Association", "Irrigators Association"];

const SUBSIDY_PRODUCTS: Record<SubsidyCategory, string[]> = {
  fertilizer: ["Complete Fertilizer 14-14-14", "Urea 46-0-0", "Ammonium Sulfate", "Organic Compost"],
  seeds: ["Hybrid Corn Seeds", "Vegetable Seeds Pack", "Eggplant Seedlings", "Tomato Seeds"],
  rice_seeds: ["NSIC Rc 222", "NSIC Rc 160", "Inbred Rice Seeds"],
  fish_fingerlings: ["Tilapia Fingerlings", "Carp Fingerlings", "Bangus Fry"],
  cash: ["Cash Assistance"],
  other: ["Farm Tools Set", "Irrigation Equipment", "Pesticide Kit"],
};
const PROGRAM_SOURCES = ["DA-PRDP", "DA-PSO", "LGU-Tubo", "PhilRice", "BFAR", "DENR", "NIA"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function uuid(): string {
  return crypto.randomUUID();
}
function rand(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(2);
}
function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(randInt(6, 18), randInt(0, 59), randInt(0, 59));
  return d.toISOString();
}

// ── Generator: Farmers ─────────────────────────────────────────────────────────
export function generateFarmers(barangay: string, count: number): Farmer[] {
  const usedNames = new Set<string>();
  const farmers: Farmer[] = [];
  for (let i = 0; i < count; i++) {
    const gender: "Male" | "Female" = i < Math.ceil(count * 0.6) ? "Male" : "Female";
    const firstPool = gender === "Male" ? MALE_FIRST : FEMALE_FIRST;
    let name = "";
    // ensure unique names within barangay
    for (let tries = 0; tries < 20; tries++) {
      name = `${pick(firstPool)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(name)) break;
    }
    usedNames.add(name);
    const ts = randomDate(60);
    farmers.push({
      id: uuid(),
      name,
      gender,
      barangay,
      household_id: null,
      is_household_head: false,
      rsbsa_number: null,
      birth_date: null,
      civil_status: null,
      photo_url: null,
      created_at: ts,
      updated_at: ts,
    });
  }
  return farmers;
}

// ── Generator: Records ─────────────────────────────────────────────────────────
type CommodityType = "Rice" | "Corn" | "Fishery" | "High Value Crops" | "Industrial Crops";

export function generateRecords(barangay: string, farmerPool: Farmer[]): AgriRecord[] {
  // 15 records per barangay: 5 Rice, 3 Corn, 3 Fishery, 3 HVC, 1 Industrial
  const plan: { commodity: CommodityType; count: number }[] = [
    { commodity: "Rice", count: 5 },
    { commodity: "Corn", count: 3 },
    { commodity: "Fishery", count: 3 },
    { commodity: "High Value Crops", count: 3 },
    { commodity: "Industrial Crops", count: 1 },
  ];

  const records: AgriRecord[] = [];
  let farmerIdx = 0;

  for (const { commodity, count } of plan) {
    for (let i = 0; i < count; i++) {
      const isFishery = commodity === "Fishery";
      const isCorn = commodity === "Corn";

      // Pick sub-category
      const subs = SUB_TYPES[commodity] || [];
      const sub_category = isCorn ? "Corn" : subs.length > 0 ? subs[i % subs.length] : commodity;

      // Assign 1-3 farmers from pool
      const assignCount = randInt(1, 3);
      const farmer_ids: string[] = [];
      for (let f = 0; f < assignCount && farmerIdx < farmerPool.length; f++) {
        farmer_ids.push(farmerPool[farmerIdx].id);
        farmerIdx = (farmerIdx + 1) % farmerPool.length;
      }

      const linkedFarmers = farmerPool.filter((f) => farmer_ids.includes(f.id));
      const farmer_male = linkedFarmers.filter((f) => f.gender === "Male").length;
      const farmer_female = linkedFarmers.filter((f) => f.gender === "Female").length;

      // Whether to include damage
      const hasDamage = Math.random() < 0.3;
      const useCalDam = !isFishery && hasDamage && Math.random() < 0.4;
      const calamity_sub_category: CalamitySubCategory = useCalDam ? pick(CALAMITY_SUBS_SEED) : "None";
      const ts = randomDate(30);

      records.push({
        id: uuid(),
        barangay,
        commodity,
        sub_category,
        farmer_ids,
        farmer_names: linkedFarmers.map((f) => f.name).join(", "),
        farmer_male,
        farmer_female,
        total_farmers: farmer_ids.length,
        planting_area_hectares: isFishery ? 0 : rand(0.5, 5),
        harvesting_output_bags: isFishery ? 0 : randInt(20, 500),
        damage_pests_hectares: isFishery ? 0 : hasDamage ? rand(0.1, 2) : 0,
        damage_calamity_hectares: isFishery ? 0 : hasDamage && Math.random() < 0.4 ? rand(0.1, 1.5) : 0,
        stocking: isFishery ? randInt(500, 5000) : 0,
        harvesting_fishery: isFishery ? randInt(100, 2000) : 0,
        pests_diseases: !isFishery && hasDamage ? pick(PESTS) : "None",
        calamity: useCalDam ? pick(CALAMITIES.filter((c) => c !== "None")) : "None",
        calamity_sub_category,
        remarks: "",
        period_month: new Date(ts).getMonth() + 1,
        period_year: new Date(ts).getFullYear(),
        created_at: ts,
        updated_at: ts,
      });
    }
  }

  return records;
}

// ── Generator: Organizations ───────────────────────────────────────────────────
export function generateOrganizations(barangay: string): Organization[] {
  const count = Math.random() < 0.5 ? 2 : 1;
  const orgs: Organization[] = [];
  const types: OrgType[] = ["cooperative", "association"];
  for (let i = 0; i < count; i++) {
    const orgType = types[i % 2];
    const suffix = orgType === "cooperative" ? pick(ORG_SUFFIXES_COOP) : pick(ORG_SUFFIXES_ASSOC);
    const ts = randomDate(90);
    orgs.push({
      id: uuid(),
      name: `${barangay} ${suffix}`,
      org_type: orgType,
      barangay,
      created_at: ts,
      updated_at: ts,
    });
  }
  return orgs;
}

// ── Generator: Households ──────────────────────────────────────────────────────
export function generateHouseholds(barangay: string, farmers: Farmer[], allOrgs: Organization[]): Household[] {
  const barangayOrgs = allOrgs.filter((o) => o.barangay === barangay);
  const households: Household[] = [];

  // Group farmers into households of 2-3 each
  let i = 0;
  while (i < farmers.length) {
    const size = randInt(2, 3);
    const group = farmers.slice(i, i + size);
    if (group.length === 0) break;

    const head = group[0];
    const ts = randomDate(90);
    const org = barangayOrgs.length > 0 && Math.random() < 0.6 ? pick(barangayOrgs) : null;

    households.push({
      id: uuid(),
      barangay,
      display_name: `${head.name} Household`,
      farming_area_hectares: rand(0.5, 3),
      rffa_subsidies_notes: "",
      organization_id: org?.id ?? null,
      created_at: ts,
      updated_at: ts,
    });

    i += size;
  }

  return households;
}

// ── Generator: Subsidies ───────────────────────────────────────────────────────
export function generateSubsidies(households: Household[]): HouseholdSubsidy[] {
  const subsidies: HouseholdSubsidy[] = [];
  const categories: SubsidyCategory[] = ["fertilizer", "seeds", "rice_seeds", "fish_fingerlings", "cash", "other"];

  for (const hh of households) {
    const count = randInt(1, 2);
    for (let i = 0; i < count; i++) {
      const category = pick(categories);
      const products = SUBSIDY_PRODUCTS[category];
      const product_detail = pick(products);
      const ts = randomDate(120);

      subsidies.push({
        id: uuid(),
        household_id: hh.id,
        category,
        product_detail,
        quantity: category === "cash" ? null : randInt(1, 50),
        unit: category === "fish_fingerlings" ? "pieces" : category === "cash" ? null : category === "fertilizer" ? "bags" : "kg",
        amount_php: category === "cash" ? randInt(500, 5000) : null,
        program_source: pick(PROGRAM_SOURCES),
        received_date: ts.slice(0, 10),
        notes: null,
        created_at: ts,
        updated_at: ts,
      });
    }
  }

  return subsidies;
}

/** Full deterministic sample: every barangay gets farmers + records (for Supabase bulk seed). */
export function buildFullSupabaseSeed(): { farmers: Farmer[]; records: AgriRecord[] } {
  const farmers: Farmer[] = [];
  const records: AgriRecord[] = [];
  for (const brgy of BARANGAYS) {
    const f = generateFarmers(brgy, 15);
    farmers.push(...f);
    records.push(...generateRecords(brgy, f));
  }
  return { farmers, records };
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function seedData(): { farmersAdded: number; recordsAdded: number; orgsAdded: number; householdsAdded: number; subsidiesAdded: number } {
  // Load existing data
  let existingRecords: AgriRecord[] = [];
  let existingFarmers: Farmer[] = [];
  let existingOrgs: Organization[] = [];
  try {
    const r = localStorage.getItem(RECORDS_KEY);
    if (r) existingRecords = JSON.parse(r);
    const f = localStorage.getItem(FARMERS_KEY);
    if (f) existingFarmers = JSON.parse(f);
    const o = localStorage.getItem(ORGANIZATIONS_KEY);
    if (o) existingOrgs = JSON.parse(o);
  } catch { /* empty */ }

  let newFarmers: Farmer[] = [];
  let newRecords: AgriRecord[] = [];

  for (const brgy of BARANGAYS) {
    // Only seed barangays that have fewer than 5 farmers (skip already populated ones)
    const brgyFarmerCount = existingFarmers.filter((f) => f.barangay === brgy).length;
    if (brgyFarmerCount >= 5) continue;

    const farmers = generateFarmers(brgy, 15);
    const records = generateRecords(brgy, farmers);
    newFarmers = [...newFarmers, ...farmers];
    newRecords = [...newRecords, ...records];
  }

  // Merge farmers + records
  const allFarmers = [...existingFarmers, ...newFarmers];
  const allRecords = [...existingRecords, ...newRecords];

  localStorage.setItem(FARMERS_KEY, JSON.stringify(allFarmers));
  localStorage.setItem(RECORDS_KEY, JSON.stringify(allRecords));

  // Seed orgs, households, subsidies only if not already present
  let orgsAdded = 0;
  let householdsAdded = 0;
  let subsidiesAdded = 0;

  if (existingOrgs.length === 0 && newFarmers.length > 0) {
    const allOrgs: Organization[] = BARANGAYS.flatMap((b) => generateOrganizations(b));
    localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(allOrgs));
    orgsAdded = allOrgs.length;

    const allHouseholds: Household[] = BARANGAYS.flatMap((b) =>
      generateHouseholds(b, newFarmers.filter((f) => f.barangay === b), allOrgs)
    );
    localStorage.setItem(HOUSEHOLDS_KEY, JSON.stringify(allHouseholds));
    householdsAdded = allHouseholds.length;

    const allSubsidies = generateSubsidies(allHouseholds);
    localStorage.setItem(SUBSIDIES_KEY, JSON.stringify(allSubsidies));
    subsidiesAdded = allSubsidies.length;
  }

  return {
    farmersAdded: newFarmers.length,
    recordsAdded: newRecords.length,
    orgsAdded,
    householdsAdded,
    subsidiesAdded,
  };
}
