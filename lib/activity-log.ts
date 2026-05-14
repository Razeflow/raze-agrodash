/**
 * logActivity — the single helper that appends an entry to public.activity_logs.
 *
 * Called by mutations in lib/agri-context.tsx AFTER the user's main Supabase
 * write succeeds. Failure of THIS helper does NOT roll back the user's
 * mutation — losing a log is preferable to losing a user's edit. This is the
 * standard "log-fail-soft" pattern.
 *
 * Identity (performed_by / _name / _role) is snapshotted from the auth
 * context at call time and stored denormalized so the log survives profile
 * edits and deletes.
 *
 * Pairs with:
 *   - migrations/019_activity_logs.sql (table + RLS)
 *   - lib/domain/activity.ts           (pure types + diff/summary helpers)
 *   - lib/data.ts                      (ActivityLog, ActivityAction enums)
 */

import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLog,
  ActivitySource,
} from "@/lib/data";
import { activityLogInsertRow } from "@/lib/insert-rows";
import { supabase } from "@/lib/supabase/client";

/** Caller-supplied actor snapshot (typically from useAuth()). */
export type ActivityActor = {
  id: string | null;
  /** Falls back to username when displayName is empty. */
  name: string | null;
  role: string | null;
};

export type LogActivityInput = {
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  /** RLS scope. The row will be rejected by Postgres RLS if it doesn't match the caller's barangay (unless they're admin). */
  barangay: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  actor: ActivityActor;
  source?: ActivitySource;
};

export type LogActivityResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

/**
 * Insert an activity log row. Fire-and-(mostly)-forget: errors are logged to
 * the console but never thrown. Returns a result object so callers can opt
 * into telemetry without try/catch noise at every site.
 */
export async function logActivity(
  input: LogActivityInput,
): Promise<LogActivityResult> {
  // Idempotent ID so a caller can correlate / dedupe if it ever needs to.
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Skip empty-diff updates (no fields changed): nothing to log.
  const isEmptyUpdate =
    (input.action === "updated" ||
      input.action === "status_changed" ||
      input.action === "damage_updated" ||
      input.action === "land_allocation_changed") &&
    !input.before &&
    !input.after;
  if (isEmptyUpdate) {
    return { ok: false, reason: "no-op (no fields changed)" };
  }

  const row: Omit<ActivityLog, "created_at"> = {
    id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    summary: input.summary ?? null,
    performed_by: input.actor.id ?? null,
    performed_by_name: input.actor.name ?? null,
    performed_by_role: input.actor.role ?? null,
    barangay: input.barangay,
    source: input.source ?? "app",
    metadata: input.metadata ?? null,
  };

  try {
    const { error } = await supabase
      .from("activity_logs")
      .insert(activityLogInsertRow(row));
    if (error) {
      // Log the failure but don't surface it — the user's main write already
      // succeeded. This keeps the log channel "best effort".
      console.warn(
        `[activity-log] failed to write ${input.entityType}:${input.action} → ${error.message}`,
      );
      return { ok: false, reason: error.message };
    }
    return { ok: true, id };
  } catch (err) {
    console.warn(
      `[activity-log] unexpected error writing ${input.entityType}:${input.action}`,
      err,
    );
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}
