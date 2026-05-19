import { supabase } from "./supabase/client";
import { friendlyDbError } from "./supabase/errors";

export type ConcurrencyTable =
  | "agri_records"
  | "farmers"
  | "households"
  | "farmer_assets";

export type ConcurrencyResult<T> =
  | { ok: true; row: T }
  | { ok: false; kind: "stale"; message: string }
  | { ok: false; kind: "db"; message: string };

export interface UpdateWithConcurrencyOptions {
  table: ConcurrencyTable;
  id: string;
  lastKnownUpdatedAt: string;
  payload: Record<string, unknown>;
  entityLabel: string;
}

/**
 * Optimistic-concurrency UPDATE for the four soft-deletable tables.
 *
 * Issues `UPDATE … WHERE id = $1 AND updated_at = $2`. If the row's current
 * updated_at differs from the caller's last-seen value, the UPDATE affects
 * zero rows and the helper returns `kind: "stale"`. The migration-022
 * BEFORE-UPDATE trigger guarantees the server bumps updated_at on every
 * write so callers cannot bypass the check by replaying their old value
 * inside the payload.
 *
 * Returned shape:
 *   - `{ ok: true, row }`              — UPDATE applied; row is the fresh
 *                                        server copy (incl. new updated_at)
 *   - `{ ok: false, kind: "stale" }`   — concurrent write detected; UI
 *                                        should ask the user to reload
 *   - `{ ok: false, kind: "db" }`      — Postgres returned an error (CHECK
 *                                        constraint, FK, etc.); message is
 *                                        already passed through friendlyDbError
 *
 * Callers must NOT include `id` or `updated_at` in `payload` — the helper
 * filters by them. (If a caller does set updated_at in payload, the trigger
 * will overwrite it anyway, but the WHERE clause comparison uses the
 * lastKnownUpdatedAt argument, not the payload value.)
 */
export async function updateWithConcurrency<T>(
  opts: UpdateWithConcurrencyOptions
): Promise<ConcurrencyResult<T>> {
  const { table, id, lastKnownUpdatedAt, payload, entityLabel } = opts;

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq("id", id)
    .eq("updated_at", lastKnownUpdatedAt)
    .select()
    .maybeSingle();

  if (error) {
    return { ok: false, kind: "db", message: friendlyDbError(error) };
  }
  if (!data) {
    return {
      ok: false,
      kind: "stale",
      message:
        `Someone else updated this ${entityLabel} while you were editing. ` +
        `Please reload to see the latest version and try again.`,
    };
  }
  return { ok: true, row: data as T };
}
