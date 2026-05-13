/**
 * Supabase insert-row builders — map domain types to the column shape PostgREST
 * expects. Kept separate from the data context so mutations stay focused on
 * state transitions rather than serialization details.
 */

import type { AgriRecord, Farmer } from "@/lib/data";
import { commodityGroupForCommodity } from "@/lib/domain/commodity";

/** Columns on public.farmers (matches scripts/seed-supabase-bulk.ts). */
export function farmerInsertRow(f: Farmer) {
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

/** Columns on public.agri_records (period_month/year added via migration 007). */
export function agriRecordInsertRow(r: AgriRecord) {
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
    fishery_loss_pieces: r.fishery_loss_pieces ?? null,
    livestock_stocking_heads: r.livestock_stocking_heads ?? null,
    livestock_output_heads: r.livestock_output_heads ?? null,
    livestock_dead_heads: r.livestock_dead_heads ?? null,
    pests_diseases: r.pests_diseases,
    calamity: r.calamity,
    calamity_sub_category: r.calamity_sub_category,
    remarks: r.remarks,
    period_month: r.period_month,
    period_year: r.period_year,
    lifecycle_status: r.lifecycle_status,
    status: r.status ?? null,
    commodity_group: r.commodity_group ?? commodityGroupForCommodity(r.commodity),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
