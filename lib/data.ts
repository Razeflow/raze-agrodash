export type AgriRecord = {
  id: string;
  barangay: string;
  commodity: "Rice" | "Corn" | "Fishery" | "High Value Crops" | "Industrial Crops";
  sub_category: string;
  farmer_ids: string[];       // linked Farmer IDs
  farmer_names: string;       // denormalized from linked farmers
  farmer_male: number;        // denormalized count
  farmer_female: number;      // denormalized count
  total_farmers: number;      // denormalized count
  planting_area_hectares: number;
  harvesting_output_bags: number; // 40kg per bag
  damage_pests_hectares: number;
  damage_calamity_hectares: number;
  stocking: number;            // Fishery only
  harvesting_fishery: number;  // Fishery only
  pests_diseases: string;
  calamity: string;
  remarks: string;
  period_month: number | null; // 1-12 reporting month
  period_year: number | null;  // e.g. 2026
  created_at: string;          // ISO timestamp
  updated_at: string;          // ISO timestamp
};

export type Farmer = {
  id: string;
  name: string;
  gender: "Male" | "Female";
  barangay: string;
  created_at: string;
  updated_at: string;
};

export const BARANGAYS = [
  "Supo",
  "Poblacion",
  "Wayangan",
  "Kili",
  "Tiempo",
  "Amtuagan",
  "Tabacda",
  "Alangtin",
  "Dilong",
  "Tubtuba",
] as const;

export const COMMODITY_OPTIONS = [
  "Rice",
  "Corn",
  "Fishery",
  "High Value Crops",
  "Industrial Crops",
] as const;

export const SUB_TYPES: Record<string, string[]> = {
  Rice: ["Hybrid", "Inbred", "Traditional"],
  Corn: [],
  Fishery: ["Tilapia", "Eel", "Palileng", "Bunog", "Udang", "Wadingan", "Kenpa", "Frog", "Carp", "Hito"],
  "High Value Crops": [
    "Coffee", "Mango", "Eggplant", "Ampalaya", "Pole Sitao", "Upo",
    "Squash", "Tomato", "Petchay", "Ginger", "Sili", "Cabbage",
    "Chinese Cabbage (Wombok)",
  ],
  "Industrial Crops": ["Sugarcane"],
};

export const COMMODITY_COLORS: Record<string, string> = {
  Rice: "#16a34a",
  Corn: "#ca8a04",
  Fishery: "#0284c7",
  "High Value Crops": "#9333ea",
  "Industrial Crops": "#ea580c",
};

// ── Philippine Timezone Helpers ──────────────────────────────────────────
const PH_TZ = "Asia/Manila";

/** Format a date string in Philippine timezone. */
export function formatDatePH(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", { timeZone: PH_TZ, ...options });
}

/** Format a date+time string in Philippine timezone. */
export function formatDateTimePH(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Get the current Philippine month (1-12) and year. */
export function getCurrentPHPeriod(): { month: number; year: number } {
  const now = new Date();
  const phStr = now.toLocaleString("en-US", { timeZone: PH_TZ, month: "numeric", year: "numeric" });
  const [m, y] = phStr.split("/").map(Number);
  return { month: m, year: y };
}

/** Format a period_month + period_year into a display string like "Mar 2026". */
export function formatPeriod(month: number | null, year: number | null): string {
  if (!month || !year) return "—";
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
