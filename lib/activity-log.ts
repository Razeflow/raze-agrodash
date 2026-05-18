/**
 * logActivity — the single helper that appends an entry to public.activity_logs.
 *
 * Called by mutations in lib/agri-context.tsx AFTER the user's main Supabase
 * write succeeds. Failure of THIS helper does NOT roll back the user's
 * mutation — losing a log is preferable to losing a user's edit. This is the
 * standard "log-fail-soft" pattern.
 *
 * Pilot Hardening (Week 3) — resilience overlay:
 *
 *   - One retry with a 2s backoff if the first insert fails (covers
 *     transient network blips and short Supabase auth-token rotations).
 *   - On second failure, the row is queued to localStorage under
 *     `agro:activity-log-retry`. The queue is capped at 50 entries; older
 *     entries past 24h are dropped automatically.
 *   - Next time a logActivity call succeeds, the queue is flushed
 *     opportunistically — one shot per queued row, anything that still
 *     fails stays in the queue for the next attempt.
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
import { debug, warn as debugWarn } from "@/lib/debug";

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

// ── Retry queue config ───────────────────────────────────────────────

/** Delay between the first attempt and the single retry. Tuned to ride out
 *  a typical token refresh or 2-3s network hiccup without leaving the user
 *  waiting (they don't await the log anyway — it's fire-and-forget). */
const RETRY_DELAY_MS = 2_000;

/** localStorage key for the persisted retry queue. */
const QUEUE_KEY = "agro:activity-log-retry";

/** Hard cap on queue size. Each entry is ~200 bytes typical, so 50 ≈ 10 KB
 *  in localStorage. Older entries get dropped when the queue is full
 *  (FIFO eviction — newest writes win). */
const QUEUE_MAX = 50;

/** Drop queued entries older than this. Prevents zombie entries from a
 *  user who logged out hours ago from sitting forever. */
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;

type QueuedEntry = {
  /** Pre-built insert row (avoids redoing the empty-diff check on flush). */
  row: Omit<ActivityLog, "created_at">;
  /** ms since epoch. Used for TTL eviction. */
  enqueuedAt: number;
};

// ── Insert + retry primitives ────────────────────────────────────────

/**
 * Single insert attempt. No retry, no queue side-effects. Catches its own
 * errors and returns a result object.
 */
async function performInsert(
  row: Omit<ActivityLog, "created_at">,
): Promise<LogActivityResult> {
  try {
    const { error } = await supabase
      .from("activity_logs")
      .insert(activityLogInsertRow(row));
    if (error) {
      return { ok: false, reason: error.message };
    }
    return { ok: true, id: row.id };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ── Persistent queue (localStorage) ──────────────────────────────────

function readQueue(): QueuedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is QueuedEntry =>
        !!e &&
        typeof e === "object" &&
        "row" in e &&
        typeof (e as QueuedEntry).enqueuedAt === "number" &&
        now - (e as QueuedEntry).enqueuedAt < QUEUE_TTL_MS,
    );
  } catch {
    // Corrupt JSON / sandbox restriction — start fresh.
    return [];
  }
}

function writeQueue(entries: QueuedEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep the newest QUEUE_MAX entries. The oldest get dropped silently.
    const trimmed = entries.slice(-QUEUE_MAX);
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded, private mode, sandboxed iframe — nothing we can do.
  }
}

function enqueueForRetry(row: Omit<ActivityLog, "created_at">): void {
  const queue = readQueue();
  queue.push({ row, enqueuedAt: Date.now() });
  writeQueue(queue);
  debug(`activity-log: queued ${row.entity_type}:${row.action} (queue size ${queue.length})`);
}

/** Guard against re-entrant flush. localStorage operations are synchronous,
 *  so the worst case without this guard is two concurrent logActivity
 *  successes both kicking off a flush, with the second one inserting
 *  duplicates. Cheap to prevent. */
let isFlushing = false;

/**
 * Attempt each queued entry exactly once. Anything that still fails goes
 * back into the queue for the next opportunity. Fire-and-forget; the
 * caller doesn't await the result.
 */
async function flushQueue(): Promise<void> {
  if (isFlushing) return;
  if (typeof window === "undefined") return;
  const queue = readQueue();
  if (queue.length === 0) return;
  isFlushing = true;
  debug(`activity-log: flushing ${queue.length} queued entries`);
  try {
    const remaining: QueuedEntry[] = [];
    let succeeded = 0;
    for (const entry of queue) {
      const result = await performInsert(entry.row);
      if (result.ok) {
        succeeded++;
      } else {
        remaining.push(entry);
      }
    }
    writeQueue(remaining);
    if (succeeded > 0) {
      debug(`activity-log: flushed ${succeeded} entries (${remaining.length} remain queued)`);
    }
  } catch (err) {
    // Defensive: flush should never throw, but if it does we recover.
    debugWarn("activity-log: flushQueue threw", err);
  } finally {
    isFlushing = false;
  }
}

// ── Public API ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Insert an activity log row. Fire-and-(mostly)-forget: errors are logged
 * via the debug logger but never thrown. Returns a result object so
 * callers can opt into telemetry without try/catch noise at every site.
 *
 * Retry behavior (Pilot Hardening Week 3):
 *   1. First insert attempt
 *   2. If it fails, wait RETRY_DELAY_MS and try once more
 *   3. If the retry also fails, queue the row to localStorage
 *   4. On any future SUCCESSFUL logActivity, flush the queue
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

  // First attempt.
  const first = await performInsert(row);
  if (first.ok) {
    // Healthy channel — opportunistically flush any queued retries.
    void flushQueue();
    return first;
  }

  debug(
    `activity-log: first attempt failed for ${row.entity_type}:${row.action}, retrying in ${RETRY_DELAY_MS}ms`,
    { reason: first.reason },
  );

  // Retry once after a short backoff.
  await sleep(RETRY_DELAY_MS);
  const second = await performInsert(row);
  if (second.ok) {
    // The retry worked. The channel might still be flaky, but try a flush
    // anyway — the worst case is one extra round-trip that fails fast.
    void flushQueue();
    return second;
  }

  // Both attempts failed. Persist for later and surface the final reason.
  enqueueForRetry(row);
  console.warn(
    `[activity-log] failed to write ${row.entity_type}:${row.action} after 1 retry → queued (reason: ${second.reason})`,
  );
  return second;
}

// ── Test/diagnostics surface ─────────────────────────────────────────

/** Inspect the current retry queue. Used by an optional admin diagnostics
 *  view and by tests. Returns a defensive copy. */
export function getActivityLogRetryQueueSize(): number {
  return readQueue().length;
}

/** Force a flush attempt now. Useful if you want a manual "retry queued
 *  logs" button somewhere later. Returns when the flush completes. */
export async function flushActivityLogRetryQueue(): Promise<void> {
  await flushQueue();
}
