"use client";

import { X, Building2, Users } from "lucide-react";
import { ORG_TYPE_LABELS, type OrgType } from "@/lib/data";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  orgType: OrgType;
  memberCount: number;
};

export default function OrganizationCreatedDialog({ open, onClose, name, orgType, memberCount }: Props) {
  const { mounted, visible } = useAnimatedMount(open);

  if (!mounted || !open) return null;

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-[70] overflow-y-auto">
        <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-emerald-100 p-3">
                  <Building2 size={20} className="text-emerald-700" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Organization created</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4 mb-4">
              <p className="text-sm font-bold text-slate-900">{name}</p>
              <p className="text-xs text-slate-600 mt-1">{ORG_TYPE_LABELS[orgType]}</p>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Users size={16} className="shrink-0" />
                <span>
                  <strong>{memberCount}</strong> member{memberCount === 1 ? "" : "s"} (distinct farmers linked to this org)
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              New groups start at <strong>0 members</strong>. To add people: open the <strong>Farmers</strong> tab, choose a
              farmer, <strong>Edit</strong>, then tick this organization under <strong>Organizations</strong>.
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[1.5rem] bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
