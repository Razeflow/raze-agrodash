"use client";

import { useState, useMemo } from "react";
import { HandCoins, Building2, Plus, Trash2, Users } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { ORG_TYPE_LABELS, SUBSIDY_CATEGORY_LABELS, type OrgType } from "@/lib/data";
import BentoCard from "@/components/ui/BentoCard";
import StatStrip from "@/components/ui/StatStrip";
import HouseholdEditDialog from "./HouseholdEditDialog";
import OrganizationCreatedDialog from "./OrganizationCreatedDialog";

const ORG_TYPES: OrgType[] = ["cooperative", "association", "household_group", "other"];

export default function ProgramsView() {
  const {
    households,
    organizationStats,
    uniqueFarmersInOrganizations,
    addOrganization,
    deleteOrganization,
    getSubsidiesForHousehold,
    householdSubsidies,
  } = useAgriData();
  const { isAdminOrAbove } = useAuth();

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<OrgType>("cooperative");
  const [hhEdit, setHhEdit] = useState<(typeof households)[0] | null>(null);
  const [orgCreated, setOrgCreated] = useState<{ name: string; org_type: OrgType; memberCount: number } | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null);

  const subsidyLineCount = householdSubsidies.length;
  const householdsWithAssistance = useMemo(
    () => new Set(householdSubsidies.map((s) => s.household_id)).size,
    [householdSubsidies],
  );

  async function handleAddOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgError(null);
    setDeleteOrgError(null);
    if (!newOrgName.trim()) return;
    const res = await addOrganization({
      name: newOrgName.trim(),
      org_type: newOrgType,
      barangay: null,
    });
    setNewOrgName("");
    if (!res.ok) {
      setOrgError(res.message);
      return;
    }
    setOrgCreated({ name: res.organization.name, org_type: res.organization.org_type, memberCount: 0 });
  }

  const inputCls =
    "rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

  const programStatItems = useMemo(
    () => [
      { id: "hh", label: "Households", value: String(households.length) },
      {
        id: "lines",
        label: "Assistance lines",
        value: String(subsidyLineCount),
        hint: "Subsidy rows recorded",
      },
      {
        id: "hhItems",
        label: "Households w/ items",
        value: String(householdsWithAssistance),
        hint: "At least one assistance line",
      },
      { id: "orgs", label: "Organizations", value: String(organizationStats.length) },
      {
        id: "farmersOrg",
        label: "Farmers in any org",
        value: String(uniqueFarmersInOrganizations),
        hint: "Distinct people",
      },
    ],
    [households.length, subsidyLineCount, householdsWithAssistance, organizationStats.length, uniqueFarmersInOrganizations],
  );

  return (
    <div className="fade-up delay-1 space-y-8">
      <BentoCard variant="compact">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Programs &amp; assistance</h2>
        <p className="mt-1 text-sm text-slate-600">
          Household-level RFFA and subsidies; organization membership uses <strong>distinct farmers</strong> (no double
          count if someone joins multiple groups).
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <strong>Subsidy line items</strong> are added inside <strong>Edit household and subsidies</strong> (Programs
          list below or Farmers → household). Run DB migration <code className="rounded bg-slate-100 px-1">002_household_subsidies</code>{" "}
          if counts stay at zero after saving.
        </p>
        <div className="mt-4">
          <StatStrip items={programStatItems} />
        </div>
      </BentoCard>

      <BentoCard
        title="Households"
        subtitle="Edit a household to set shared area, RFFA notes, and structured subsidy / assistance line items"
        icon={HandCoins}
        collapsible
        defaultExpanded
      >
        <div className="space-y-3">
          {households.length === 0 ? (
            <p className="text-sm text-slate-400">No households yet. Register a farmer to create one.</p>
          ) : (
            households.map((h) => {
              const subs = getSubsidiesForHousehold(h.id);
              const catLabels = [...new Set(subs.map((s) => SUBSIDY_CATEGORY_LABELS[s.category]))];
              const subPreview =
                subs.length > 0
                  ? `${subs.length} item(s): ${catLabels.slice(0, 4).join(", ")}${catLabels.length > 4 ? "…" : ""}`
                  : "";
              const preview = h.rffa_subsidies_notes?.slice(0, 120) || "";
              const more = (h.rffa_subsidies_notes?.length || 0) > 120;
              return (
                <div
                  key={h.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/40 bg-white/50 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{h.display_name || "Unnamed household"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {h.barangay} · {h.farming_area_hectares ?? 0} ha shared
                    </p>
                    {subPreview && (
                      <p className="text-xs font-medium text-emerald-800 mt-2 line-clamp-1">{subPreview}</p>
                    )}
                    {preview && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {preview}
                        {more ? "…" : ""}
                      </p>
                    )}
                    {!subPreview && !preview && (
                      <p className="text-xs text-slate-400 italic mt-2">No assistance lines yet — use the button to add.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHhEdit(h)}
                    className="shrink-0 rounded-[1.5rem] bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Edit household and subsidies
                  </button>
                </div>
              );
            })
          )}
        </div>
      </BentoCard>

      <BentoCard title="Organizations" subtitle="Member counts are distinct farmers" icon={Building2} collapsible defaultExpanded>
        {!isAdminOrAbove && (
          <p className="mb-4 text-sm text-slate-600">
            Organizations are managed by municipal admins. You can still assign farmers to existing groups from the farmer form.
          </p>
        )}
        {(orgError || deleteOrgError) && (
          <div className="mb-4 rounded-2xl bg-red-50/70 border border-red-200/50 px-4 py-2.5 text-sm font-medium text-red-700">
            {orgError || deleteOrgError}
          </div>
        )}
        {isAdminOrAbove && (
          <form onSubmit={handleAddOrg} className="mb-6 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
              <input className={`w-full ${inputCls}`} value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Coop or association name" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Type</label>
              <select className={`${inputCls} min-w-[160px]`} value={newOrgType} onChange={(e) => setNewOrgType(e.target.value as OrgType)}>
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ORG_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-[1.5rem] bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
            >
              <Plus size={14} /> Add organization
            </button>
          </form>
        )}

        <div className="space-y-2">
          {organizationStats.length === 0 ? (
            <p className="text-sm text-slate-400">No organizations. Add one above.</p>
          ) : (
            organizationStats.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-xl bg-white p-2 border border-slate-100">
                    <Users size={16} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{o.name}</p>
                    <p className="text-xs text-slate-500">{ORG_TYPE_LABELS[o.org_type]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    {o.memberCount} members
                  </span>
                  {isAdminOrAbove && (
                    <button
                      type="button"
                      onClick={async () => {
                        setDeleteOrgError(null);
                        const res = await deleteOrganization(o.id);
                        if (!res.ok) setDeleteOrgError(res.message);
                      }}
                      className="rounded-xl p-2 text-red-500 hover:bg-red-50 transition"
                      title="Delete organization"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </BentoCard>

      <HouseholdEditDialog open={!!hhEdit} onClose={() => setHhEdit(null)} household={hhEdit} />
      <OrganizationCreatedDialog
        open={!!orgCreated}
        onClose={() => setOrgCreated(null)}
        name={orgCreated?.name ?? ""}
        orgType={orgCreated?.org_type ?? "other"}
        memberCount={orgCreated?.memberCount ?? 0}
      />
    </div>
  );
}
