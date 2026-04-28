/**
 * Bulk seed farmers + agri_records using the service role (bypasses RLS).
 * Run from project root: npm run seed:supabase
 *
 * Clean slate: deletes farmer_organizations, agri_records, farmers (in that order).
 * Does not touch profiles, auth.users, households, organizations.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgriRecord, Farmer } from "../lib/data";
import { buildFullSupabaseSeed } from "../lib/seed-data";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const SENTINEL = "00000000-0000-0000-0000-000000000000";

function farmerInsertRow(f: Farmer) {
  return {
    id: f.id,
    name: f.name,
    gender: f.gender,
    barangay: f.barangay,
    household_id: f.household_id,
    is_household_head: f.is_household_head,
    rsbsa_number: f.rsbsa_number,
    birth_date: f.birth_date,
    civil_status: f.civil_status,
    photo_url: f.photo_url,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

/** Columns that exist on public.agri_records (excludes period_month/year client-only fields). */
function agriRecordInsertRow(r: AgriRecord) {
  return {
    id: r.id,
    barangay: r.barangay,
    commodity: r.commodity,
    sub_category: r.sub_category,
    farmer_ids: r.farmer_ids,
    farmer_names: r.farmer_names,
    farmer_male: r.farmer_male,
    farmer_female: r.farmer_female,
    total_farmers: r.total_farmers,
    planting_area_hectares: r.planting_area_hectares,
    harvesting_output_bags: r.harvesting_output_bags,
    damage_pests_hectares: r.damage_pests_hectares,
    damage_calamity_hectares: r.damage_calamity_hectares,
    stocking: r.stocking,
    harvesting_fishery: r.harvesting_fishery,
    pests_diseases: r.pests_diseases,
    calamity: r.calamity,
    calamity_sub_category: r.calamity_sub_category,
    remarks: r.remarks,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function deleteAll(client: SupabaseClient, table: string, column: "id" | "farmer_id") {
  const { error } = await client.from(table).delete().neq(column, SENTINEL);
  if (error) {
    console.error(`[seed] delete ${table}:`, error.message);
    throw error;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed] Deleting farmer_organizations, agri_records, farmers…");
  await deleteAll(client, "farmer_organizations", "farmer_id");
  await deleteAll(client, "agri_records", "id");
  await deleteAll(client, "farmers", "id");

  const { farmers, records } = buildFullSupabaseSeed({ farmersPerBrgy: 30, recordsPerBrgy: 50 });
  console.log(`[seed] Inserting ${farmers.length} farmers, ${records.length} records…`);

  const BATCH = 80;
  for (const part of chunk(farmers, BATCH)) {
    const { error } = await client.from("farmers").insert(part.map(farmerInsertRow));
    if (error) {
      console.error("[seed] farmers insert:", error.message);
      throw error;
    }
  }
  for (const part of chunk(records, BATCH)) {
    const { error } = await client.from("agri_records").insert(part.map(agriRecordInsertRow));
    if (error) {
      console.error("[seed] agri_records insert:", error.message);
      throw error;
    }
  }

  console.log("[seed] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
