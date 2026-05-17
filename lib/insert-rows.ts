/**
 * Supabase insert-row builders — map domain types to the column shape PostgREST
 * expects. Kept separate from the data context so mutations stay focused on
 * state transitions rather than serialization details.
 */

import type { ActivityLog, AgriRecord, AppError, Farmer } from "@/lib/data";
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
    farmer_asset_id: r.farmer_asset_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** Columns on public.activity_logs (Phase Next, migration 019). */
export function activityLogInsertRow(log: Omit<ActivityLog, "created_at">) {
  return {
    id: log.id,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    action: log.action,
    before: log.before,
    after: log.after,
    summary: log.summary,
    performed_by: log.performed_by,
    performed_by_name: log.performed_by_name,
    performed_by_role: log.performed_by_role,
    barangay: log.barangay,
    source: log.source,
    metadata: log.metadata,
  };
}

/** Columns on public.app_errors (Pilot hardening, migration 021). */
export function appErrorInsertRow(e: Omit<AppError, "created_at">) {
  return {
    id: e.id,
    user_id: e.user_id,
    username: e.username,
    role: e.role,
    barangay: e.barangay,
    message: e.message,
    name: e.name,
    stack: e.stack,
    context: e.context,
    url: e.url,
    user_agent: e.user_agent,
  };
}
