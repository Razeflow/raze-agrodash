"use client";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { AlertTriangle, Bug, CloudLightning, MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function RiskLevel({ area }: { area: number }) {
  if (area >= 2)
    return (
      <span className="animate-pulse rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
        CRITICAL
      </span>
    );
  if (area >= 1)
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-500">
        HIGH
      </span>
    );
  if (area > 0)
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-600">
        MODERATE
      </span>
    );
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-400">
      LOW
    </span>
  );
}

function riskBorderColor(area: number) {
  if (area >= 2) return "border-l-red-500";
  if (area >= 1) return "border-l-orange-400";
  if (area > 0) return "border-l-yellow-400";
  return "border-l-gray-200";
}

function TrendIndicator({ trend }: { trend: "increasing" | "decreasing" | "stable" }) {
  if (trend === "increasing")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
        <TrendingUp size={13} /> Increasing
      </span>
    );
  if (trend === "decreasing")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <TrendingDown size={13} /> Decreasing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
      <Minus size={13} /> Stable
    </span>
  );
}

export default function DamageRiskMonitoring() {
  const {
    damageRiskData, damageByCommodity, totalDamagedArea,
    damageByBarangay, mostAffectedBarangay, damagePercentage,
    affectedFarmerCount, damageTrend, totalPlantingArea,
  } = useAgriData();

  // Unique pests
  const pestMap: Record<string, string[]> = {};
  const calamityMap: Record<string, string[]> = {};
  damageRiskData.forEach((r) => {
    if (r.pests_diseases !== "None") {
      if (!pestMap[r.commodity]) pestMap[r.commodity] = [];
      r.pests_diseases.split(",").map((p) => p.trim()).forEach((p) => {
        if (!pestMap[r.commodity].includes(p)) pestMap[r.commodity].push(p);
      });
    }
    if (r.calamity !== "None") {
      if (!calamityMap[r.commodity]) calamityMap[r.commodity] = [];
      if (!calamityMap[r.commodity].includes(r.calamity)) calamityMap[r.commodity].push(r.calamity);
    }
  });

  // ── Empty state ──────────────────────────────────────────────────────────
  if (damageRiskData.length === 0) {
    return (
      <div className="fade-up delay-1 rounded-2xl border border-gray-100 bg-gray-50/60 p-14 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <AlertTriangle size={28} className="text-gray-300" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-gray-500">No Damage Reports</h3>
        <p className="mx-auto max-w-sm text-sm text-gray-400">
          When damage from pests, diseases, or calamities is recorded in commodity entries, analysis will appear here.
        </p>
      </div>
    );
  }

  const mostAffectedDamage = mostAffectedBarangay !== "None" ? +(damageByBarangay[mostAffectedBarangay] ?? 0).toFixed(2) : 0;

  return (
    <div className="space-y-4">
      {/* ── Most Affected Barangay Banner ────────────────────────────────── */}
      {mostAffectedBarangay !== "None" && (
        <div className="fade-up rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <MapPin size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Most Affected Barangay</p>
                <p className="text-lg font-bold text-red-700">{mostAffectedBarangay}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-red-400">Total Damage</p>
                <p className="font-mono font-bold text-red-600">{mostAffectedDamage} ha</p>
              </div>
              <div>
                <p className="text-xs text-red-400">Affected Farmers</p>
                <p className="font-mono font-bold text-red-600">{affectedFarmerCount}</p>
              </div>
              <div>
                <p className="text-xs text-red-400">Damage % of Planting Area</p>
                <p className="font-mono font-bold text-red-600">{damagePercentage}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3-column grid ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Damage bar chart */}
        <div className="fade-up delay-1 rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Damaged Area by Commodity
            </h2>
          </div>
          <p className="mb-1 text-xs text-gray-400">Hectares affected</p>
          <p className="mb-1 font-mono text-2xl font-bold text-red-500">{totalDamagedArea} ha</p>
          <div className="mb-1">
            <TrendIndicator trend={damageTrend} />
          </div>
          <p className="mb-4 text-xs text-gray-400">{damagePercentage}% of total planting area</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={damageByCommodity} barSize={22} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fef2f2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${v} ha`, "Damage"]} />
              <Bar dataKey="area" radius={[0, 6, 6, 0]}>
                {damageByCommodity.map((e) => (
                  <Cell key={e.name} fill={COMMODITY_COLORS[e.name] || "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pests & Diseases */}
        <div className="fade-up delay-2 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Bug size={15} className="text-orange-500" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Pests & Diseases
            </h2>
          </div>
          <p className="mb-4 text-xs text-gray-400">By commodity</p>
          <div className="space-y-3">
            {Object.entries(pestMap).map(([comm, pests]) => (
              <div key={comm}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: COMMODITY_COLORS[comm] }} />
                  <span className="text-xs font-semibold text-gray-600">{comm}</span>
                </div>
                <div className="flex flex-wrap gap-1 pl-4">
                  {pests.map((p) => (
                    <span key={p} className="rounded-md bg-orange-50 px-2 py-0.5 text-xs text-orange-600">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calamities + critical records */}
        <div className="fade-up delay-3 rounded-2xl border border-yellow-100 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <CloudLightning size={15} className="text-yellow-600" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Calamities & Critical Zones
            </h2>
          </div>
          <p className="mb-4 text-xs text-gray-400">Affected barangays</p>

          <div className="mb-4 space-y-2">
            {Object.entries(calamityMap).map(([comm, cals]) => (
              <div key={comm} className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-gray-500 w-28 shrink-0">{comm}</span>
                {cals.map((c) => (
                  <span key={c} className="rounded-md bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700 font-medium">{c}</span>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-50 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Top Damaged</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {damageRiskData.slice(0, 8).map((r) => {
                const totalDmg = r.damage_pests_hectares + r.damage_calamity_hectares;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-lg border-l-4 bg-gray-50 px-3 py-1.5 ${riskBorderColor(totalDmg)}`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{r.barangay}</p>
                      <p className="text-xs text-gray-400">
                        {r.commodity} · {r.sub_category} · {r.total_farmers} farmer{r.total_farmers !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RiskLevel area={totalDmg} />
                      <span className="font-mono text-xs text-gray-500">{totalDmg} ha</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
