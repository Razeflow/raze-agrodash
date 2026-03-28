import type { AgriRecord, Farmer } from "./data";
import { BARANGAYS, SUB_TYPES } from "./data";

const RECORDS_KEY = "raze-agridash-records";
const FARMERS_KEY = "raze-agridash-farmers";

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

// ── Generator ──────────────────────────────────────────────────────────────────
function generateFarmers(barangay: string, count: number): Farmer[] {
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
      created_at: ts,
      updated_at: ts,
    });
  }
  return farmers;
}

type CommodityType = "Rice" | "Corn" | "Fishery" | "High Value Crops" | "Industrial Crops";

function generateRecords(barangay: string, farmerPool: Farmer[]): AgriRecord[] {
  // Distribute: 3 Rice, 2 Corn, 2 Fishery, 2 HVC, 1 Industrial
  const plan: { commodity: CommodityType; count: number }[] = [
    { commodity: "Rice", count: 3 },
    { commodity: "Corn", count: 2 },
    { commodity: "Fishery", count: 2 },
    { commodity: "High Value Crops", count: 2 },
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

      // Assign 1-2 farmers from pool
      const assignCount = randInt(1, 2);
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
        calamity: !isFishery && hasDamage && Math.random() < 0.4 ? pick(CALAMITIES.filter((c) => c !== "None")) : "None",
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

// ── Public API ─────────────────────────────────────────────────────────────────
export function seedData(): { farmersAdded: number; recordsAdded: number } {
  // Load existing data
  let existingRecords: AgriRecord[] = [];
  let existingFarmers: Farmer[] = [];
  try {
    const r = localStorage.getItem(RECORDS_KEY);
    if (r) existingRecords = JSON.parse(r);
    const f = localStorage.getItem(FARMERS_KEY);
    if (f) existingFarmers = JSON.parse(f);
  } catch { /* empty */ }

  const existingBarangays = new Set(existingFarmers.map((f) => f.barangay));

  let newFarmers: Farmer[] = [];
  let newRecords: AgriRecord[] = [];

  for (const brgy of BARANGAYS) {
    // Only seed barangays that have fewer than 5 farmers (skip already populated ones)
    const brgyFarmerCount = existingFarmers.filter((f) => f.barangay === brgy).length;
    if (brgyFarmerCount >= 5) continue;

    const farmers = generateFarmers(brgy, 10);
    const records = generateRecords(brgy, farmers);
    newFarmers = [...newFarmers, ...farmers];
    newRecords = [...newRecords, ...records];
  }

  // Merge
  const allFarmers = [...existingFarmers, ...newFarmers];
  const allRecords = [...existingRecords, ...newRecords];

  localStorage.setItem(FARMERS_KEY, JSON.stringify(allFarmers));
  localStorage.setItem(RECORDS_KEY, JSON.stringify(allRecords));

  return { farmersAdded: newFarmers.length, recordsAdded: newRecords.length };
}
