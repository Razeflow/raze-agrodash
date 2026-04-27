"use client";

import { X, HandCoins, ChevronRight } from "lucide-react";
import type { Farmer, Household, HouseholdSubsidy } from "@/lib/data";
import { formatHouseholdSubsidySummary } from "@/lib/data";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  households: Household[];
  farmers: Farmer[];
  getSubsidiesForHousehold: (householdId: string) => HouseholdSubsidy[];
  onEditHousehold: (h: Household) => void;
};

export default function HouseholdBrowseDialog({
  open,
  onClose,
  households,
  farmers,
  getSubsidiesForHousehold,
  onEditHousehold,
}: Props) {
  const { mounted, visible } = useAnimatedMount(open);

  if (!mounted) return null;

  const sorted = [...households].sort((a, b) =>
    (a.display_name || "").localeCompare(b.display_name || "", undefined, { sensitivity: "base" }),
  );

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-[55] overflow-y-auto">
        <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-lg max-h-[min(88vh,820px)] overflow-hidden flex flex-col rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-white/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-100 p-2">
                  <HandCoins size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Households &amp; assistance</h2>
                  <p className="text-[11px] text-slate-500">RFFA notes and subsidy line items per household</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition" aria-label="Close">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {sorted.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No households in your scope yet.</p>
              ) : (
                sorted.map((h) => {
                  const subs = getSubsidiesForHousehold(h.id);
                  const members = farmers.filter((f) => f.household_id === h.id);
                  const summary = formatHouseholdSubsidySummary(subs);
                  const notesPreview = h.rffa_subsidies_notes?.slice(0, 100) || "";
                  const notesMore = (h.rffa_subsidies_notes?.length || 0) > 100;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        onEditHousehold(h);
                      }}
                      className="w-full text-left rounded-2xl border border-white/50 bg-white/60 p-4 hover:bg-white/90 hover:border-emerald-200/60 transition flex items-start gap-3 group"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{h.display_name || "Unnamed household"}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.barangay} · {members.length} member{members.length !== 1 ? "s" : ""} · {subs.length} assistance line
                          {subs.length !== 1 ? "s" : ""}
                        </p>
                        {summary ? (
                          <p className="text-[11px] text-emerald-900/90 font-medium line-clamp-2">{summary}</p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No structured assistance lines yet</p>
                        )}
                        {notesPreview ? (
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {notesPreview}
                            {notesMore ? "…" : ""}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-slate-300 group-hover:text-emerald-600 mt-1" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
