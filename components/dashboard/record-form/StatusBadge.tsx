"use client";

import type { RecordStatus } from "@/lib/domain/status";

const STYLES: Record<RecordStatus, string> = {
  active: "bg-sky-50 text-sky-700 border-sky-200/60",
  harvested: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  damaged: "bg-red-50 text-red-700 border-red-200/60",
  archived: "bg-slate-100 text-slate-600 border-slate-200/70",
};

const LABELS: Record<RecordStatus, string> = {
  active: "Active",
  harvested: "Harvested",
  damaged: "Damaged",
  archived: "Archived",
};

export default function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${STYLES[status]}`}
      title={`Status: ${LABELS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

