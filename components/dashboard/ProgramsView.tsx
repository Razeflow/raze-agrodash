"use client";

import { useEffect, useMemo, useState } from "react";
import { HandCoins, Building2, Plus, Trash2, Users } from "lucide-react";
import { useAgriData } from "@/lib/agri-context";
import { useAuth } from "@/lib/auth-context";
import { ORG_TYPE_LABELS, SUBSIDY_CATEGORY_LABELS, type OrgType } from "@/lib/data";
import BentoCard from "@/components/ui/BentoCard";
import StatStrip from "@/components/ui/StatStrip";
import HouseholdEditDialog from "./HouseholdEditDialog";
import OrganizationCreatedDialog from "./OrganizationCreatedDialog";
import OrganizationMembersDialog from "./OrganizationMembersDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const ORG_TYPES: OrgType[] = ["cooperative", "association", "household_group", "other"];
const PER_PAGE_OPTIONS = [10, 25, 50] as const;

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
  const [membersOrgId, setMembersOrgId] = useState<string | null>(null);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<{ id: string; name: string } | null>(null);

  const [hhPerPage, setHhPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);
  const [hhPage, setHhPage] = useState(1);
  const [orgPerPage, setOrgPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);
  const [orgPage, setOrgPage] = useState(1);

  const subsidyLineCount = householdSubsidies.length;
  const householdsWithAssistance = useMemo(
    () => new Set(householdSubsidies.map((s) => s.household_id)).size,
    [householdSubsidies],
  );

  const visibleHouseholds = households;
  const visibleOrganizations = organizationStats;

  const hhTotalPages = Math.max(1, Math.ceil(visibleHouseholds.length / hhPerPage));
  const orgTotalPages = Math.max(1, Math.ceil(visibleOrganizations.length / orgPerPage));

  useEffect(() => {
    if (hhPage > hhTotalPages) setHhPage(hhTotalPages);
  }, [hhPage, hhTotalPages]);

  useEffect(() => {
    if (orgPage > orgTotalPages) setOrgPage(orgTotalPages);
  }, [orgPage, orgTotalPages]);

  const pagedHouseholds = useMemo(() => {
    const start = (hhPage - 1) * hhPerPage;
    return visibleHouseholds.slice(start, start + hhPerPage);
  }, [visibleHouseholds, hhPage, hhPerPage]);

  const pagedOrganizations = useMemo(() => {
    const start = (orgPage - 1) * orgPerPage;
    return visibleOrganizations.slice(start, start + orgPerPage);
  }, [visibleOrganizations, orgPage, orgPerPage]);

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

  function PaginationControls({
    page,
    totalPages,
    perPage,
    onPerPageChange,
    onPageChange,
    itemCount,
    itemLabel,
  }: {
    page: number;
    totalPages: number;
    perPage: number;
    onPerPageChange: (n: (typeof PER_PAGE_OPTIONS)[number]) => void;
    onPageChange: (n: number) => void;
    itemCount: number;
    itemLabel: string;
  }) {
    const pages = useMemo(() => {
      const maxButtons = 7;
      if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);
      const clamped = Math.min(Math.max(page, 1), totalPages);
      const start = Math.max(1, clamped - 2);
      const end = Math.min(totalPages, start + 4);
      const adjustedStart = Math.max(1, end - 4);
      const core = Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);
      return [1, ...core.filter((p) => p !== 1 && p !== totalPages), totalPages].filter(
        (p, i, a) => a.indexOf(p) === i,
      );
    }, [page, totalPages]);

    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Per page</span>
          <select
            className="h-8 rounded-[1.25rem] border border-slate-200/50 bg-white/60 px-3 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            value={perPage}
            onChange={(e) => {
              onPerPageChange(Number(e.target.value) as (typeof PER_PAGE_OPTIONS)[number]);
              onPageChange(1);
            }}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {itemCount} {itemLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="h-8 rounded-[1.25rem] border border-slate-200/50 bg-white/60 px-3 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition"
          >
            Prev
          </button>
          <div className="flex items-center gap-1">
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`h-8 min-w-8 rounded-[1.25rem] px-3 text-xs font-black transition ${
                  p === page ? "bg-slate-950 text-white" : "border border-slate-200/50 bg-white/60 text-slate-700 hover:bg-white"
                }`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="h-8 rounded-[1.25rem] border border-slate-200/50 bg-white/60 px-3 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

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
        <PaginationControls
          page={hhPage}
          totalPages={hhTotalPages}
          perPage={hhPerPage}
          onPerPageChange={setHhPerPage}
          onPageChange={setHhPage}
          itemCount={visibleHouseholds.length}
          itemLabel={visibleHouseholds.length === 1 ? "household" : "households"}
        />
        <div className="space-y-3">
          {visibleHouseholds.length === 0 ? (
            <p className="text-sm text-slate-400">No households yet. Register a farmer to create one.</p>
          ) : (
            pagedHouseholds.map((h) => {
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

        <PaginationControls
          page={orgPage}
          totalPages={orgTotalPages}
          perPage={orgPerPage}
          onPerPageChange={setOrgPerPage}
          onPageChange={setOrgPage}
          itemCount={visibleOrganizations.length}
          itemLabel={visibleOrganizations.length === 1 ? "organization" : "organizations"}
        />

        <div className="space-y-2">
          {visibleOrganizations.length === 0 ? (
            <p className="text-sm text-slate-400">No organizations. Add one above.</p>
          ) : (
            pagedOrganizations.map((o) => (
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
                    <button
                      type="button"
                      onClick={() => setMembersOrgId(o.id)}
                      className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-200/70 transition"
                      title="View members"
                    >
                      {o.memberCount} members
                    </button>
                  </span>
                  {isAdminOrAbove && (
                    <button
                      type="button"
                      onClick={() => setDeleteOrgTarget({ id: o.id, name: o.name })}
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

      <OrganizationMembersDialog
        open={!!membersOrgId}
        onClose={() => setMembersOrgId(null)}
        organizationId={membersOrgId}
      />

      <ConfirmDialog
        open={!!deleteOrgTarget}
        onClose={() => setDeleteOrgTarget(null)}
        title="Delete organization"
        description={
          deleteOrgTarget
            ? `This will remove "${deleteOrgTarget.name}" and unlink it from members and households. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        typeToConfirmText={deleteOrgTarget?.name ?? undefined}
        onConfirm={async () => {
          if (!deleteOrgTarget) return false;
          setDeleteOrgError(null);
          const res = await deleteOrganization(deleteOrgTarget.id);
          if (!res.ok) {
            setDeleteOrgError(res.message);
            return false;
          }
        }}
      />
    </div>
  );
}
