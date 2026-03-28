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
