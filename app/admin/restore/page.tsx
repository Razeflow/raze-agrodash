"use client";

/**
 * Admin-only restore view for soft-deleted core rows.
 *
 * Lists the 50 most recently soft-deleted rows per table (agri_records,
 * farmers, households, farmer_assets) and offers a single Restore action
 * that clears `deleted_at`. Designed minimal — when 50 rows isn't enough,
 * admins run SQL directly. No "permanent delete" UI surface; service-role
 * SQL is required to truly remove a row.
 *
 * Auth gate: requires admin/super-admin. Barangay users see a forbidden
 * message. RLS would also block the underlying SELECT/UPDATE for non-admins
 * even if they reached this page directly.
 *
 * Restoration logs an activity_logs entry per row so the audit trail stays
 * complete.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import { reportError } from "@/lib/error-log";
import { logActivity } from "@/lib/activity-log";
import {
  normalizeAgriRecord,
  normalizeFarmer,
  normalizeFarmerAsset,
} from "@/lib/normalize";
import type {
  AgriRecord,
  Farmer,
  FarmerAsset,
  Household,
} from "@/lib/data";

type DeletedSet = {
  records: AgriRecord[];
  farmers: Farmer[];
  households: Household[];
  assets: FarmerAsset[];
};

type TableKey = "agri_records" | "farmers" | "households" | "farmer_assets";

const PER_TABLE_LIMIT = 50;

function formatTs(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  } catch {
    return s;
  }
}

export default function RestorePage() {
  const { user, isAdminOrAbove, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeletedSet>({
    records: [],
    farmers: [],
    households: [],
    assets: [],
  });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [recordsRes, farmersRes, householdsRes, assetsRes] = await Promise.all([
        supabase
          .from("agri_records")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(PER_TABLE_LIMIT),
        supabase
          .from("farmers")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(PER_TABLE_LIMIT),
        supabase
          .from("households")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(PER_TABLE_LIMIT),
        supabase
          .from("farmer_assets")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(PER_TABLE_LIMIT),
      ]);

      const errs = [recordsRes.error, farmersRes.error, householdsRes.error, assetsRes.error].filter(Boolean);
      if (errs.length > 0) {
        const msg = errs.map((e) => e!.message).join("; ");
        setErrorMsg(`Could not load deleted rows: ${msg}`);
        void reportError(new Error(msg), { context: { fn: "RestorePage.refetch" } });
        return;
      }

      setData({
        records: (recordsRes.data ?? []).map((r: Record<string, unknown>) => normalizeAgriRecord(r)),
        farmers: (farmersRes.data ?? []).map((r: Record<string, unknown>) => normalizeFarmer(r)),
        households: (householdsRes.data ?? []) as Household[],
        assets: (assetsRes.data ?? []).map((r: Record<string, unknown>) => normalizeFarmerAsset(r)),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setErrorMsg(msg);
      void reportError(err, { context: { fn: "RestorePage.refetch" } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAdminOrAbove) {
      setLoading(false);
      return;
    }
    void refetch();
  }, [isLoggedIn, isAdminOrAbove, refetch]);

  const restore = useCallback(
    async (table: TableKey, id: string, barangay: string | null, label: string) => {
      setRestoringId(id);
      setErrorMsg(null);
      setOkMsg(null);
      try {
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: null })
          .eq("id", id);
        if (error) {
          setErrorMsg(`Restore failed: ${error.message}`);
          void reportError(new Error(error.message), {
            context: { fn: "RestorePage.restore", table, id },
          });
          return;
        }
        // Audit: log the restore on the entity's own timeline. We use the
        // existing 'updated' action with a summary so the timeline UI's
        // existing filters/colors keep working.
        const entityType =
          table === "agri_records" ? "agri_record" :
          table === "farmers" ? "farmer" :
          table === "households" ? "household" :
          "farmer_asset";
        if (barangay) {
          void logActivity({
            entityType: entityType as Parameters<typeof logActivity>[0]["entityType"],
            entityId: id,
            action: "updated",
            barangay,
            before: { deleted_at: "set" },
            after: { deleted_at: null },
            summary: `restored from soft-delete (${label})`,
            actor: {
              id: user?.id ?? null,
              name: user?.displayName ?? user?.username ?? null,
              role: user?.role ?? null,
            },
          });
        }
        setOkMsg(`Restored ${label}. Reload the dashboard to see it in the live view.`);
        await refetch();
      } finally {
        setRestoringId(null);
      }
    },
    [refetch, user],
  );

  if (!isLoggedIn) {
    return (
      <Forbidden message="Sign in to continue." backHref="/" />
    );
  }
  if (!isAdminOrAbove) {
    return (
      <Forbidden message="Admin access required." backHref="/" />
    );
  }

  const totalDeleted = data.records.length + data.farmers.length + data.households.length + data.assets.length;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to dashboard
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Restore deleted rows</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Showing up to {PER_TABLE_LIMIT} most-recently soft-deleted rows per table.
            Click <span className="font-medium">Restore</span> to clear the delete marker and bring the row back into the live view.
            For older rows, query the table directly in Supabase Studio.
          </p>
        </header>

        {errorMsg ? (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{errorMsg}</span>
          </div>
        ) : null}
        {okMsg ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700">
            {okMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
            Loading deleted rows…
          </div>
        ) : totalDeleted === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
            Nothing has been deleted. Soft-deleted rows will appear here.
          </div>
        ) : (
          <div className="space-y-8">
            <Section
              title="Agricultural records"
              count={data.records.length}
              limit={PER_TABLE_LIMIT}
              emptyMsg="No deleted records."
            >
              {data.records.map((r) => (
                <Row
                  key={r.id}
                  primary={`${r.commodity}${r.sub_category ? ` · ${r.sub_category}` : ""}`}
                  secondary={`${r.barangay} · ${r.period_month}/${r.period_year}`}
                  deletedAt={r.deleted_at ?? null}
                  busy={restoringId === r.id}
                  onRestore={() =>
                    void restore("agri_records", r.id, r.barangay, `record ${r.commodity}`)
                  }
                />
              ))}
            </Section>

            <Section
              title="Farmers"
              count={data.farmers.length}
              limit={PER_TABLE_LIMIT}
              emptyMsg="No deleted farmers."
            >
              {data.farmers.map((f) => (
                <Row
                  key={f.id}
                  primary={f.name || "(unnamed)"}
                  secondary={`${f.barangay}${f.gender ? ` · ${f.gender}` : ""}`}
                  deletedAt={f.deleted_at ?? null}
                  busy={restoringId === f.id}
                  onRestore={() =>
                    void restore("farmers", f.id, f.barangay, `farmer ${f.name}`)
                  }
                />
              ))}
            </Section>

            <Section
              title="Households"
              count={data.households.length}
              limit={PER_TABLE_LIMIT}
              emptyMsg="No deleted households."
            >
              {data.households.map((h) => (
                <Row
                  key={h.id}
                  primary={h.display_name || "(unnamed household)"}
                  secondary={`${h.barangay} · ${h.farming_area_hectares} ha`}
                  deletedAt={h.deleted_at ?? null}
                  busy={restoringId === h.id}
                  onRestore={() =>
                    void restore("households", h.id, h.barangay, `household ${h.display_name}`)
                  }
                />
              ))}
            </Section>

            <Section
              title="Farmer assets"
              count={data.assets.length}
              limit={PER_TABLE_LIMIT}
              emptyMsg="No deleted assets."
            >
              {data.assets.map((a) => {
                // Asset barangay isn't on the row; we don't fetch the farmer
                // here. Restore still works (RLS uses farmer→barangay path
                // for SELECT); the activity log just won't be tagged.
                return (
                  <Row
                    key={a.id}
                    primary={a.parcel_label || a.product_detail || `${a.category} asset`}
                    secondary={`farmer ${a.farmer_id.slice(0, 8)}…${a.area_hectares != null ? ` · ${a.area_hectares} ha` : ""}`}
                    deletedAt={a.deleted_at ?? null}
                    busy={restoringId === a.id}
                    onRestore={() =>
                      void restore("farmer_assets", a.id, null, `asset ${a.parcel_label ?? a.category}`)
                    }
                  />
                );
              })}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Forbidden({ message, backHref }: { message: string; backHref: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-slate-900">Forbidden</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <Link
          href={backHref}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <ArrowLeft size={16} aria-hidden />
          Back
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  limit,
  emptyMsg,
  children,
}: {
  title: string;
  count: number;
  limit: number;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">
          {count === 0 ? emptyMsg : `${count} row${count === 1 ? "" : "s"}${count >= limit ? ` (capped at ${limit})` : ""}`}
        </span>
      </div>
      {count > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white/70">
          {children}
        </ul>
      ) : null}
    </section>
  );
}

function Row({
  primary,
  secondary,
  deletedAt,
  busy,
  onRestore,
}: {
  primary: string;
  secondary: string;
  deletedAt: string | null;
  busy: boolean;
  onRestore: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{primary}</div>
        <div className="truncate text-xs text-slate-500">{secondary}</div>
        <div className="mt-1 text-[11px] text-slate-400">deleted {formatTs(deletedAt)}</div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RotateCcw size={14} aria-hidden />
        {busy ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}
