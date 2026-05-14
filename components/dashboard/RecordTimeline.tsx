"use client";

/**
 * RecordTimeline — operational history panel for a single agri_record.
 *
 * Lazy-loaded by RecordFormDialog when the user opens the "Timeline" tab.
 * Reads via the bare useActivityLog hook (no Provider, no preload).
 *
 * Renders entries newest-first, grouped by day in PH time. Each entry shows:
 *   icon + colored chip (severity) + summary + actor + relative timestamp.
 *
 * Pagination is cursor-based — "Load older" appends the next 20 without
 * resetting scroll position.
 */

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Gift,
  History,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ActivityAction, ActivityLog } from "@/lib/data";
import { formatDatePH, formatDateTimePH } from "@/lib/data";
import { useActivityLog } from "@/lib/contexts/activity-context";

type Props = {
  recordId: string;
  /** Only fetch once the panel becomes visible. Pass the tab's open state. */
  active: boolean;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Icon + color per ActivityAction.
 *
 * Color scheme uses Tailwind utility classes so it composes with the existing
 * dialog styling. Keep this map aligned with the icon table in the plan doc.
 * ────────────────────────────────────────────────────────────────────── */

type ActionStyle = {
  Icon: LucideIcon;
  iconCls: string;     // text color for the icon glyph
  chipCls: string;     // background + border for the chip wrapper
  label: string;       // human-readable action label
};

const ACTION_STYLES: Record<ActivityAction, ActionStyle> = {
  created: {
    Icon: Plus,
    iconCls: "text-emerald-600",
    chipCls: "bg-emerald-50 border-emerald-200 text-emerald-700",
    label: "Created",
  },
  updated: {
    Icon: Pencil,
    iconCls: "text-slate-500",
    chipCls: "bg-slate-50 border-slate-200 text-slate-700",
    label: "Updated",
  },
  status_changed: {
    Icon: RefreshCw,
    iconCls: "text-indigo-600",
    chipCls: "bg-indigo-50 border-indigo-200 text-indigo-700",
    label: "Status changed",
  },
  archived: {
    Icon: Archive,
    iconCls: "text-zinc-600",
    chipCls: "bg-zinc-100 border-zinc-200 text-zinc-700",
    label: "Archived",
  },
  damage_updated: {
    Icon: AlertTriangle,
    iconCls: "text-amber-600",
    chipCls: "bg-amber-50 border-amber-200 text-amber-700",
    label: "Damage updated",
  },
  land_allocation_changed: {
    Icon: MapPin,
    iconCls: "text-sky-600",
    chipCls: "bg-sky-50 border-sky-200 text-sky-700",
    label: "Land allocation changed",
  },
  deleted: {
    Icon: Trash2,
    iconCls: "text-rose-600",
    chipCls: "bg-rose-50 border-rose-200 text-rose-700",
    label: "Deleted",
  },
  allocation_overflow_attempt: {
    Icon: ShieldAlert,
    iconCls: "text-red-600",
    chipCls: "bg-red-50 border-red-200 text-red-700",
    label: "Overflow attempt (rejected)",
  },
  household_transferred: {
    Icon: ArrowRightLeft,
    iconCls: "text-violet-600",
    chipCls: "bg-violet-50 border-violet-200 text-violet-700",
    label: "Household transferred",
  },
  subsidy_added: {
    Icon: Gift,
    iconCls: "text-teal-600",
    chipCls: "bg-teal-50 border-teal-200 text-teal-700",
    label: "Subsidy added",
  },
  subsidy_updated: {
    Icon: Gift,
    iconCls: "text-teal-600",
    chipCls: "bg-teal-50 border-teal-200 text-teal-700",
    label: "Subsidy updated",
  },
  subsidy_removed: {
    Icon: Gift,
    iconCls: "text-teal-600",
    chipCls: "bg-teal-50 border-teal-200 text-teal-700",
    label: "Subsidy removed",
  },
  org_membership_changed: {
    Icon: Users,
    iconCls: "text-purple-600",
    chipCls: "bg-purple-50 border-purple-200 text-purple-700",
    label: "Org membership changed",
  },
};

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

/** Group entries by `YYYY-MM-DD` day in PH timezone. Order preserved. */
function groupByDay(entries: ActivityLog[]): { dayKey: string; dayLabel: string; entries: ActivityLog[] }[] {
  const buckets: { dayKey: string; dayLabel: string; entries: ActivityLog[] }[] = [];
  for (const entry of entries) {
    const dayKey = formatDatePH(entry.created_at, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dayLabel = formatDatePH(entry.created_at, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const last = buckets[buckets.length - 1];
    if (last && last.dayKey === dayKey) {
      last.entries.push(entry);
    } else {
      buckets.push({ dayKey, dayLabel, entries: [entry] });
    }
  }
  return buckets;
}

function actorLabel(entry: ActivityLog): string {
  const name = entry.performed_by_name?.trim() || "Unknown user";
  const role = entry.performed_by_role?.trim();
  return role ? `${name} · ${role}` : name;
}

/** Short relative time, e.g. "2h ago". Falls back to full timestamp past a week. */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const deltaMs = Date.now() - t;
  const min = Math.round(deltaMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDateTimePH(iso);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────── */

export default function RecordTimeline({ recordId, active }: Props) {
  const { entries, loading, loadingMore, error, hasMore, reload, loadMore } =
    useActivityLog("agri_record", recordId, { enabled: active });

  if (!active) return null;

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-400">
        <RefreshCw size={14} className="mr-2 animate-spin" /> Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Couldn't load activity timeline.</p>
          <p className="text-xs mt-0.5 opacity-80">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <History size={28} className="text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-500">No activity recorded yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Edits to this record will appear here as a timeline.
        </p>
      </div>
    );
  }

  const days = groupByDay(entries);

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.dayKey}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {day.dayLabel}
          </h3>
          <ol className="space-y-2">
            {day.entries.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ol>
        </section>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium transition ${
              loadingMore
                ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                : "bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            {loadingMore ? (
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

/* ─────────────────────────────────────────────────────────────────────────
 * Row
 * ────────────────────────────────────────────────────────────────────── */

function TimelineRow({ entry }: { entry: ActivityLog }) {
  const style = ACTION_STYLES[entry.action];
  const Icon = style.Icon;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/60 px-3 py-2.5 backdrop-blur-sm">
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${style.chipCls}`}
        aria-hidden
      >
        <Icon size={14} className={style.iconCls} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chipCls}`}
          >
            {style.label}
          </span>
          <span
            className="text-[10px] text-slate-400"
            title={formatDateTimePH(entry.created_at)}
          >
            {relativeTime(entry.created_at)}
          </span>
        </div>
        {entry.summary && (
          <p className="mt-1 text-sm text-slate-700">{entry.summary}</p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-400">
          by <span className="font-medium text-slate-500">{actorLabel(entry)}</span>
        </p>
      </div>
    </li>
  );
}
