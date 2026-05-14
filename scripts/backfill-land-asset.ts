/**
 * Phase D — backfill agri_records.farmer_asset_id for historical CROP rows.
 *
 * Runs out-of-band with the service role (bypasses RLS). For each active CROP
 * record that has no farmer_asset_id, picks the most plausible planting_area
 * asset belonging to one of the record's farmers and assigns it — IFF that
 * assignment would not push the asset over its capacity.
 *
 * Heuristic (intentionally conservative):
 *   1. Collect every planting_area asset whose owner is in record.farmer_ids
 *      and whose area_hectares is set.
 *   2. For each candidate, compute remaining capacity = area_hectares minus
 *      the sum of *other* active CROP records already pointing at it.
 *   3. Drop candidates whose remaining capacity < this record's planting area.
 *   4. From the survivors, pick the one with the largest remaining capacity
 *      (so two records on the same farmer's land end up balanced, and we
 *      avoid pinning a tiny lot when a bigger one is available).
 *   5. If no candidate survives, skip and log — the operator must reconcile
 *      manually (add a parcel, split the record, or accept the legacy NULL).
 *
 * Usage:
 *   npx tsx scripts/backfill-land-asset.ts           # dry run (default)
 *   npx tsx scripts/backfill-land-asset.ts --apply   # actually writes
 *
 * Re-runnable: the script only touches rows where farmer_asset_id IS NULL.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const APPLY = process.argv.includes("--apply");

type AgriRecordRow = {
  id: string;
  commodity: string;
  commodity_group: string | null;
  status: string | null;
  farmer_ids: string[] | null;
  planting_area_hectares: number | null;
  farmer_asset_id: string | null;
};

type FarmerAssetRow = {
  id: string;
  farmer_id: string;
  category: string;
  area_hectares: number | null;
  parcel_label: string | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`[backfill] mode=${APPLY ? "APPLY" : "DRY RUN"}`);

  const { data: records, error: recErr } = await supabase
    .from("agri_records")
    .select("id, commodity, commodity_group, status, farmer_ids, planting_area_hectares, farmer_asset_id")
    .is("farmer_asset_id", null);
  if (recErr) {
    console.error("Failed to load agri_records:", recErr.message);
    process.exit(1);
  }

  const { data: assets, error: aErr } = await supabase
    .from("farmer_assets")
    .select("id, farmer_id, category, area_hectares, parcel_label")
    .eq("category", "planting_area");
  if (aErr) {
    console.error("Failed to load farmer_assets:", aErr.message);
    process.exit(1);
  }

  // Pull all active CROP records once to compute remaining-on-asset cheaply.
  const { data: allActive, error: actErr } = await supabase
    .from("agri_records")
    .select("id, farmer_asset_id, planting_area_hectares, status, commodity_group")
    .eq("status", "active");
  if (actErr) {
    console.error("Failed to load active records:", actErr.message);
    process.exit(1);
  }

  const usedByAsset = new Map<string, number>();
  for (const r of (allActive ?? []) as AgriRecordRow[]) {
    if (!r.farmer_asset_id) continue;
    if (r.commodity_group !== "CROP") continue;
    usedByAsset.set(
      r.farmer_asset_id,
      (usedByAsset.get(r.farmer_asset_id) ?? 0) + Number(r.planting_area_hectares ?? 0),
    );
  }

  const assetsByFarmer = new Map<string, FarmerAssetRow[]>();
  for (const a of (assets ?? []) as FarmerAssetRow[]) {
    if (!a.farmer_id) continue;
    const arr = assetsByFarmer.get(a.farmer_id) ?? [];
    arr.push(a);
    assetsByFarmer.set(a.farmer_id, arr);
  }

  let assigned = 0;
  let skippedNonCrop = 0;
  let skippedInactive = 0;
  let skippedNoCandidate = 0;
  let skippedOverflow = 0;
  const updates: { id: string; farmer_asset_id: string; label: string }[] = [];

  for (const r of (records ?? []) as AgriRecordRow[]) {
    if (r.commodity_group !== "CROP") {
      skippedNonCrop++;
      continue;
    }
    if (r.status !== "active") {
      // Inactive (harvested/damaged/archived) records don't consume — backfill
      // is unnecessary. Leave them NULL; reporting unaffected.
      skippedInactive++;
      continue;
    }
    const farmerIds = r.farmer_ids ?? [];
    const proposed = Number(r.planting_area_hectares ?? 0);

    const candidates: { asset: FarmerAssetRow; remaining: number }[] = [];
    for (const fid of farmerIds) {
      for (const a of assetsByFarmer.get(fid) ?? []) {
        const total = Number(a.area_hectares ?? 0);
        if (total <= 0) continue;
        const used = usedByAsset.get(a.id) ?? 0;
        const remaining = total - used;
        if (remaining + 1e-6 >= proposed) {
          candidates.push({ asset: a, remaining });
        }
      }
    }

    if (candidates.length === 0) {
      // Check if there were any candidates at all (before the capacity filter)
      // to give a more useful skip reason.
      const anyAsset = farmerIds.some((fid) => (assetsByFarmer.get(fid) ?? []).length > 0);
      if (anyAsset) skippedOverflow++;
      else skippedNoCandidate++;
      console.log(
        `  SKIP record=${r.id} farmers=${farmerIds.length} area=${proposed.toFixed(2)} reason=${anyAsset ? "no-capacity" : "no-asset"}`,
      );
      continue;
    }

    // Largest remaining wins — balances assignments and avoids pinning tight lots.
    candidates.sort((a, b) => b.remaining - a.remaining);
    const pick = candidates[0]!;
    const label = pick.asset.parcel_label?.trim() || `Lot ${pick.asset.id.slice(0, 8)}`;

    updates.push({ id: r.id, farmer_asset_id: pick.asset.id, label });
    // Reserve capacity locally so subsequent records on the same asset see the
    // post-assignment number instead of pretending nothing changed.
    usedByAsset.set(pick.asset.id, (usedByAsset.get(pick.asset.id) ?? 0) + proposed);
    assigned++;
  }

  console.log(`\n[backfill] candidates: ${(records ?? []).length}`);
  console.log(`[backfill] would assign:   ${assigned}`);
  console.log(`[backfill] skip non-CROP:  ${skippedNonCrop}`);
  console.log(`[backfill] skip inactive:  ${skippedInactive} (no allocation needed)`);
  console.log(`[backfill] skip no-asset:  ${skippedNoCandidate} (farmer has no planting_area)`);
  console.log(`[backfill] skip overflow:  ${skippedOverflow} (would exceed capacity)`);

  if (!APPLY) {
    console.log("\n[backfill] dry run — pass --apply to write.");
    if (updates.length > 0) {
      console.log("\nPreview (first 10 assignments):");
      for (const u of updates.slice(0, 10)) {
        console.log(`  ${u.id} → ${u.farmer_asset_id} (${u.label})`);
      }
    }
    return;
  }

  let written = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("agri_records")
      .update({ farmer_asset_id: u.farmer_asset_id })
      .eq("id", u.id);
    if (error) {
      console.error(`  FAIL ${u.id} → ${u.farmer_asset_id}: ${error.message}`);
      continue;
    }
    written++;
  }
  console.log(`\n[backfill] wrote ${written}/${updates.length} assignments.`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
