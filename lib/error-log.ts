/**
 * reportError — single helper for writing operational error rows to
 * public.app_errors. Sibling to lib/activity-log.ts but a distinct channel:
 *
 *   - logActivity()  → successful domain mutations (audit trail)
 *   - reportError()  → caught exceptions / unexpected failures (visibility)
 *
 * Called from catch blocks across the app. Fire-and-forget: the helper
 * swallows its own errors, so instrumenting a catch block can never
 * make the app more fragile.
 *
 * Caller-provided actor takes precedence; if absent, the helper falls back
 * to whatever the Supabase auth session exposes synchronously. Profile
 * fields (role, barangay) are NOT fetched here — pass them in via actor
 * when you need full attribution.
 *
 * Pairs with:
 *   - migrations/021_app_errors.sql (table + RLS)
 *   - lib/data.ts                   (AppError type)
 *   - lib/insert-rows.ts            (appErrorInsertRow)
 */

import { appErrorInsertRow } from "@/lib/insert-rows";
import { supabase } from "@/lib/supabase/client";

const STACK_MAX = 8000;
const MESSAGE_MAX = 2000;

/** Caller-supplied identity snapshot (typically from useAuth()). */
export type ErrorActor = {
  id: string | null;
  /** Falls back to username if displayName is empty. */
  name: string | null;
  role: string | null;
  /** RLS scope. NULL means admin-tagged (super-admin / admin without barangay). */
  barangay: string | null;
};

export type ReportErrorOptions = {
  /** Free-form attachment: { fn, recordId, source, ... }. */
  context?: Record<string, unknown>;
  /** Caller-provided identity. If omitted, helper falls back to auth session id only. */
  actor?: ErrorActor | null;
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return truncate(err.message || err.name || "Error", MESSAGE_MAX);
  if (typeof err === "string") return truncate(err, MESSAGE_MAX);
  try {
    return truncate(JSON.stringify(err) ?? "Unknown error", MESSAGE_MAX);
  } catch {
    return "Unknown error (unserializable)";
  }
}

function extractName(err: unknown): string | null {
  if (err instanceof Error) return err.name || null;
  return null;
}

function extractStack(err: unknown): string | null {
  if (err instanceof Error && typeof err.stack === "string") {
    return truncate(err.stack, STACK_MAX);
  }
  return null;
}

function readWindowContext(): { url: string | null; userAgent: string | null } {
  if (typeof window === "undefined") return { url: null, userAgent: null };
  try {
    const url = `${window.location.pathname}${window.location.search}`;
    const userAgent = window.navigator?.userAgent ?? null;
    return { url, userAgent };
  } catch {
    return { url: null, userAgent: null };
  }
}

async function resolveActorId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Insert an app_errors row. Best-effort: every failure mode is swallowed
 * so the caller's catch block stays unaffected. Always returns void.
 *
 * Usage:
 *   try { ... } catch (err) {
 *     console.error("[fn] ...", err);
 *     void reportError(err, { context: { fn: "addRecord", recordId }, actor });
 *   }
 */
export async function reportError(
  err: unknown,
  options: ReportErrorOptions = {},
): Promise<void> {
  try {
    const actor = options.actor ?? null;
    const userId = actor?.id ?? (await resolveActorId());
    const { url, userAgent } = readWindowContext();

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const row = appErrorInsertRow({
      id,
      user_id: userId,
      username: actor?.name ?? null,
      role: actor?.role ?? null,
      barangay: actor?.barangay ?? null,
      message: extractMessage(err),
      name: extractName(err),
      stack: extractStack(err),
      context: options.context ?? null,
      url,
      user_agent: userAgent,
    });

    const { error } = await supabase.from("app_errors").insert(row);
    if (error) {
      // Best-effort: warn only. RLS rejection or table missing should never
      // bubble back to the caller's catch block.
      console.warn(`[error-log] failed to write app_errors row → ${error.message}`);
    }
  } catch (innerErr) {
    // Defense in depth: any unexpected throw in the helper itself is swallowed.
    try {
      console.warn("[error-log] unexpected error in reportError", innerErr);
    } catch {
      // Even console.warn can fail in some sandboxed envs — give up silently.
    }
  }
}
