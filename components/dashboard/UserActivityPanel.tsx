"use client";

/**
 * Phase 5 — User Activity / investigation panel.
 *
 * Cross-cutting feed of activity_logs entries with server-side filters
 * (entity type / action / barangay / date range) on top of RLS scoping
 * (admins see all; barangay users see their own barangay). Cursor-paginated
 * via useActivityFeed; full CSV export via exportActivityCsv.
 *
 * Not a record-scoped panel — that's RecordTimeline (Phase 2). This one is
 * the answer to "show me everything done in X barangay over the last
 * fortnight" and "give me the audit trail as a spreadsheet".
 */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  History,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  BARANGAYS,
  formatDateTimePH,
  type ActivityAction,
  type ActivityEntityType,
  type ActivityLog,
} from "@/lib/data";
import { sortBy } from "@/lib/sort";
import { useAuth } from "@/lib/auth-context";
import {
  useActivityFeed,
  type ActivityFeedFilter,
} from "@/lib/contexts/activity-context";
import { exportActivityCsv } from "@/lib/export-activity-csv";
import BentoCard from "@/components/ui/BentoCard";

const ACTION_LABEL: Record<ActivityAction, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  status_changed: "Status changed",
  archived: "Archived",
  land_allocation_changed: "Land allocation",
  damage_updated: "Damage updated",
  household_transferred: "Household transferred",
  allocation_overflow_attempt: "Overflow attempt",
  subsidy_added: "Subsidy added",
  subsidy_updated: "Subsidy updated",
  subsidy_removed: "Subsidy removed",
  org_membership_changed: "Org membership",
};

const ENTITY_LABEL: Record<ActivityEntityType, string> = {
  agri_record: "Record",
  farmer: "Farmer",
  household: "Household",
  farmer_asset: "Farmer asset",
  organization: "Organization",
  household_subsidy: "Subsidy",
  farmer_organization: "Org membership",
};

/** Background hue per action — keep aligned with RecordTimeline. */
const ACTION_HUE: Record<ActivityAction, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-slate-50 text-slate-700 border-slate-200",
  deleted: "bg-rose-50 text-rose-700 border-rose-200",
  status_changed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  archived: "bg-zinc-100 text-zinc-700 border-zinc-200",
  land_allocation_changed: "bg-sky-50 text-sky-700 border-sky-200",
  damage_updated: "bg-amber-50 text-amber-700 border-amber-200",
  household_transferred: "bg-violet-50 text-violet-700 border-violet-200",
  allocation_overflow_attempt: "bg-red-50 text-red-700 border-red-200",
  subsidy_added: "bg-teal-50 text-teal-700 border-teal-200",
  subsidy_updated: "bg-teal-50 text-teal-700 border-teal-200",
  subsidy_removed: "bg-teal-50 text-teal-700 border-teal-200",
  org_membership_changed: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function UserActivityPanel() {
  const { isBarangayUser, userBarangay, isAdminOrAbove } = useAuth();

  // Filter state. Barangay users are RLS-scoped already, but pinning the
  // dropdown value to their barangay keeps the UI honest.
  const [entityType, setEntityType] = useState<"" | ActivityEntityType>("");
  const [action, setAction] = useState<"" | ActivityAction>("");
  const [barangay, setBarangay] = useState<string>(
    isBarangayUser && userBarangay ? userBarangay : "",
  );
  const [since, setSince] = useState<string>(""); // YYYY-MM-DD
  const [until, setUntil] = useState<string>(""); // YYYY-MM-DD

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const sortedBarangays = useMemo(() => sortBy([...BARANGAYS], (b) => b), []);

  // Build the filter object. Empty string → undefined so the hook skips the
  // column. PostgREST accepts YYYY-MM-DD for both gte and lt on timestamptz;
  // we widen `until` by one day so end-of-day inclusive feels natural.
  const filter: ActivityFeedFilter = useMemo(() => {
    const f: ActivityFeedFilter = {};
    if (entityType) f.entityType = entityType;
    if (action) f.action = action;
    if (barangay) f.barangay = barangay;
    if (since) f.since = since;
    if (until) {
      const d = new Date(`${until}T00:00:00`);
      d.setDate(d.getDate() + 1);
      f.until = d.toISOString().slice(0, 10);
    }
    return f;
  }, [entityType, action, barangay, since, until]);

  const feed = useActivityFeed(filter);

  async function onExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const result = await exportActivityCsv(filter);
      if (!result.ok) {
        setExportMsg(`Export failed: ${result.reason}`);
      } else {
        const note = result.truncated
          ? ` (truncated at the 10,000-row cap — narrow filters and re-run)`
          : "";
        setExportMsg(`Exported ${result.rows.toLocaleString()} row${result.rows === 1 ? "" : "s"}${note}`);
      }
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Export error.");
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 6_000);
    }
  }

  function resetFilters() {
    setEntityType("");
    setAction("");
    setBarangay(isBarangayUser && userBarangay ? userBarangay : "");
    setSince("");
    setUntil("");
  }

  const anyFiltered =
    !!entityType || !!action || !!barangay || !!since || !!until;

  return (
    <div className="space-y-5">
      <BentoCard
        title="User Activity"
        subtitle="Operational history across every entity. Barangay-scoped for non-admins."
        icon={History}
        action={
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || feed.loading}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              exporting || feed.loading
                ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
            title="Export the current filter set to CSV (up to 10,000 rows)"
          >
            {exporting ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      >
        {/* Filter bar */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <FilterField label="Entity">
            <select
              className={selectCls}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as "" | ActivityEntityType)}
            >
              <option value="">All entities</option>
              {ACTIVITY_ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>{ENTITY_LABEL[et]}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Action">
            <select
              className={selectCls}
              value={action}
              onChange={(e) => setAction(e.target.value as "" | ActivityAction)}
            >
              <option value="">All actions</option>
              {ACTIVITY_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABEL[a]}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Barangay">
            {isBarangayUser ? (
              <div className={`${selectCls} bg-white/30 cursor-not-allowed flex items-center`}>
                <span className="text-gray-700 font-medium">{userBarangay}</span>
                <span className="ml-auto text-[10px] text-gray-400">🔒</span>
              </div>
            ) : (
              <select
                className={selectCls}
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
              >
                <option value="">All barangays</option>
                {sortedBarangays.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </FilterField>

          <FilterField label="From">
            <input
              type="date"
              className={selectCls}
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </FilterField>

          <FilterField label="To">
            <input
              type="date"
              className={selectCls}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </FilterField>
        </div>

        {anyFiltered && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {exportMsg && (
          <div className="mt-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 px-3 py-2 text-xs text-emerald-700">
            {exportMsg}
          </div>
        )}
      </BentoCard>

      <BentoCard noPadding>
        <FeedBody feed={feed} />
      </BentoCard>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────────────── */

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition";

function FeedBody({
  feed,
}: {
  feed: ReturnType<typeof useActivityFeed>;
}) {
  if (feed.loading && feed.entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-400">
        <RefreshCw size={14} className="mr-2 animate-spin" /> Loading activity…
      </div>
    );
  }

  if (feed.error) {
    return (
      <div className="m-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Couldn't load activity.</p>
          <p className="text-xs mt-0.5 opacity-80">{feed.error}</p>
          <button
            type="button"
            onClick={() => void feed.reload()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (feed.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search size={28} className="text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-500">No activity matches these filters.</p>
        <p className="mt-1 text-xs text-slate-400">Try widening the date range or clearing filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Entity</th>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Summary</th>
            <th className="px-4 py-2">Actor</th>
            <th className="px-4 py-2">Barangay</th>
          </tr>
        </thead>
        <tbody>
          {feed.entries.map((entry) => (
            <FeedRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>

      {feed.hasMore && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            disabled={feed.loadingMore}
            onClick={() => void feed.loadMore()}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              feed.loadingMore
                ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                : "bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 border-slate-200"
            }`}
          >
            {feed.loadingMore ? (
              <>
                <RefreshCw size={12} className="animate-spin" /> Loading…
              </>
            ) : (
              <>Load older</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FeedRow({ entry }: { entry: ActivityLog }) {
  const actorName = entry.performed_by_name?.trim() || "Unknown";
  const actorRole = entry.performed_by_role?.trim() ?? "";
  return (
    <tr className="border-b border-slate-100/70 hover:bg-slate-50/40">
      <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
        {formatDateTimePH(entry.created_at)}
      </td>
      <td className="px-4 py-2.5 text-[12px] text-slate-600 whitespace-nowrap">
        {ENTITY_LABEL[entry.entity_type]}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_HUE[entry.action]}`}
        >
          {ACTION_LABEL[entry.action]}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-700 max-w-md">
        {entry.summary ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-2.5 text-[12px] whitespace-nowrap">
        <span className="font-medium text-slate-700">{actorName}</span>
        {actorRole && <span className="ml-1 text-slate-400">· {actorRole}</span>}
      </td>
      <td className="px-4 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">
        {entry.barangay}
      </td>
    </tr>
  );
}
