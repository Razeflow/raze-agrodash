/**
 * Activity-log CSV exporter.
 *
 * Audit exports need ALL matching rows, not just the visible page, so this
 * walks the cursor pagination in a loop and accumulates rows up to a safety
 * cap. The browser then downloads the CSV via an in-memory blob.
 *
 * Trades:
 *   - No streaming download (the whole result lives in memory before the
 *     download fires). Acceptable up to the MAX_ROWS cap below; at higher
 *     scale this should move to a server-side route handler with a streamed
 *     PostgREST cursor.
 *   - JSON columns (before / after / metadata) are stringified as compact
 *     JSON, double-quoted per RFC 4180. This is what Excel and DataGrip can
 *     both ingest.
 */

import { normalizeActivityLog } from "@/lib/normalize";
import { supabase } from "@/lib/supabase/client";
import type { ActivityFeedFilter } from "@/lib/contexts/activity-context";

/** Hard ceiling on rows pulled per export. Reaching this cap is logged. */
const MAX_ROWS = 10_000;
const PAGE_SIZE = 500;

export type ExportActivityCsvResult =
  | { ok: true; rows: number; truncated: boolean; filename: string }
  | { ok: false; reason: string };

/**
 * Stream-fetch all activity_logs rows matching `filter` (capped at MAX_ROWS),
 * convert to CSV, and trigger a browser download. RLS still applies — barangay
 * users implicitly export only their barangay's rows.
 */
export async function exportActivityCsv(
  filter: ActivityFeedFilter,
  options?: { filename?: string },
): Promise<ExportActivityCsvResult> {
  const rows: Record<string, unknown>[] = [];
  let cursor: { created_at: string; id: string } | null = null;
  let truncated = false;

  // Outer loop: walk pages until either exhausted or we hit MAX_ROWS.
  while (rows.length < MAX_ROWS) {
    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);

    if (filter.entityType) query = query.eq("entity_type", filter.entityType);
    if (filter.action) query = query.eq("action", filter.action);
    if (filter.performedBy) query = query.eq("performed_by", filter.performedBy);
    if (filter.barangay) query = query.eq("barangay", filter.barangay);
    if (filter.since) query = query.gte("created_at", filter.since);
    if (filter.until) query = query.lt("created_at", filter.until);

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) return { ok: false, reason: error.message };
    if (!data || data.length === 0) break;

    for (const r of data) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      rows.push(r as Record<string, unknown>);
    }

    if (truncated || data.length < PAGE_SIZE) break;

    const last = data[data.length - 1] as Record<string, unknown>;
    cursor = {
      created_at: String(last.created_at ?? ""),
      id: String(last.id ?? ""),
    };
  }

  const csv = rowsToCsv(rows.map((r) => normalizeActivityLog(r)));
  const filename = options?.filename ?? defaultFilename(filter);
  triggerDownload(csv, filename);
  return { ok: true, rows: rows.length, truncated, filename };
}

/* ─────────────────────────────────────────────────────────────────────────
 * CSV serialisation
 * ────────────────────────────────────────────────────────────────────── */

const CSV_HEADER = [
  "created_at",
  "entity_type",
  "entity_id",
  "action",
  "performed_by",
  "performed_by_name",
  "performed_by_role",
  "barangay",
  "summary",
  "source",
  "before",
  "after",
  "metadata",
];

import type { ActivityLog } from "@/lib/data";

function rowsToCsv(entries: ActivityLog[]): string {
  const lines: string[] = [CSV_HEADER.join(",")];
  for (const e of entries) {
    const cells = [
      e.created_at,
      e.entity_type,
      e.entity_id,
      e.action,
      e.performed_by ?? "",
      e.performed_by_name ?? "",
      e.performed_by_role ?? "",
      e.barangay,
      e.summary ?? "",
      e.source,
      e.before ? JSON.stringify(e.before) : "",
      e.after ? JSON.stringify(e.after) : "",
      e.metadata ? JSON.stringify(e.metadata) : "",
    ];
    lines.push(cells.map(csvEscape).join(","));
  }
  // CRLF per RFC 4180 — friendlier to Excel on Windows.
  return lines.join("\r\n") + "\r\n";
}

/** RFC 4180 cell escape: wrap in quotes if any of comma, quote, CR, LF appear; double inner quotes. */
function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Download
 * ────────────────────────────────────────────────────────────────────── */

function triggerDownload(content: string, filename: string) {
  if (typeof window === "undefined") return;
  // BOM so Excel opens UTF-8 cleanly on non-en locales.
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the click definitely committed first.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function defaultFilename(filter: ActivityFeedFilter): string {
  const parts: string[] = ["activity"];
  if (filter.barangay) parts.push(filter.barangay.toLowerCase());
  if (filter.entityType) parts.push(filter.entityType);
  if (filter.action) parts.push(filter.action);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  parts.push(stamp);
  return parts.join("_") + ".csv";
}
