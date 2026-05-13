/**
 * Translate raw Supabase / Postgres errors into user-friendly messages.
 * Most importantly converts CHECK constraint violations (code 23514) — which
 * surface as "new row for relation … violates check constraint …" — into a
 * sentence an LGU encoder can act on. Other errors fall back to the raw
 * message so we never silently lose information.
 */
export function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23514") {
    const msg = error.message;
    if (msg.includes("planting_area_sane")) return "Planting area is out of range — must be 0–10,000 ha.";
    if (msg.includes("harvest_bags_sane")) return "Harvest output is out of range — must be 0–1,000,000 bags.";
    if (msg.includes("pests_damage_sane") || msg.includes("calamity_damage_sane"))
      return "Damage area is out of range — must be 0–10,000 ha.";
    if (msg.includes("stocking_sane") || msg.includes("fishery_harvest_sane"))
      return "Fishery value is out of range — must be 0–1,000,000.";
    if (msg.includes("total_farmers_sane")) return "Farmer count is out of range — must be 0–10,000.";
    if (msg.includes("period_month_valid")) return "Reporting month must be between 1 and 12.";
    if (msg.includes("period_year_valid")) return "Reporting year must be between 2020 and 2100.";
    if (msg.includes("lifecycle_status_valid")) return "Lifecycle status must be planted, damaged, harvested, or total_loss.";
    return "One of the values failed a sanity check — please verify and try again.";
  }
  if (error.code === "23505") return "That record already exists (duplicate value).";
  if (error.code === "23503") return "Referenced record was not found — please refresh and retry.";
  if (error.code === "23502") return "A required field was missing.";
  return error.message;
}
