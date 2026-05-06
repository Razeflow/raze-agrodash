"use client";

import { useMemo } from "react";
import { X, Users, MapPin, Home, ArrowUpRight } from "lucide-react";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";
import { useAgriData } from "@/lib/agri-context";
import { ORG_TYPE_LABELS } from "@/lib/data";
import { sortBy } from "@/lib/sort";
import { displayNameParts, fullNameSortKey, lastNameSortKey } from "@/lib/name";

type Props = {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
};

export default function OrganizationMembersDialog({ open, onClose, organizationId }: Props) {
  const { farmers, farmerOrganizations, organizations, getHousehold } = useAgriData();
  const { mounted, visible } = useAnimatedMount(open);

  const org = useMemo(
    () => (organizationId ? organizations.find((o) => o.id === organizationId) : undefined),
    [organizationId, organizations],
  );

  const members = useMemo(() => {
    if (!organizationId) return [];
    const ids = new Set(
      farmerOrganizations
        .filter((r) => r.organization_id === organizationId)
        .map((r) => r.farmer_id),
    );
    const scoped = farmers.filter((f) => ids.has(f.id));
    return sortBy(scoped, (f) => lastNameSortKey(f.name) || fullNameSortKey(f.name));
  }, [organizationId, farmerOrganizations, farmers]);

  if (!mounted || !organizationId || !org) return null;

  function openFarmer(farmerId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "farmers");
    params.set("farmerId", farmerId);
    if (organizationId) params.set("orgId", organizationId);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", nextUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
    onClose();
  }

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-[70] overflow-y-auto">
        <div
          className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`}
          onClick={onClose}
        />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 shadow-2xl dialog-panel ${
              visible ? "dialog-panel-visible" : ""
            }`}
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-white/30 px-6 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="rounded-xl bg-emerald-100 p-2 shrink-0">
                  <Users size={18} className="text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-800 truncate">{org.name}</h2>
                  <p className="text-[11px] text-slate-500">
                    {ORG_TYPE_LABELS[org.org_type]} · {members.length} member{members.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl p-1 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {members.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No members yet.</p>
              ) : (
                members.map((m) => {
                  const np = displayNameParts(m.name);
                  const hh = m.household_id ? getHousehold(m.household_id) : undefined;
                  const status = m.household_id ? (m.is_household_head ? "Household head" : "Member") : "No household";
                  return (
                    <div
                      key={m.id}
                      className="w-full text-left rounded-2xl border border-white/50 bg-white/60 p-4 flex flex-wrap items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openFarmer(m.id)}
                          className="text-left hover:underline inline-flex items-start gap-1"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-black text-slate-800 truncate">{np.last || m.name}</span>
                            <span className="block text-[11px] font-semibold text-slate-600 truncate">
                              {np.firstMiddle || "—"}
                            </span>
                          </span>
                          <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        </button>
                        <div className="mt-1 space-y-1">
                          <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" /> {m.barangay}
                          </p>
                          <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <Home size={12} className="text-slate-400" /> {hh ? hh.display_name : "—"}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                        {status}
                      </span>
                    </div>
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

