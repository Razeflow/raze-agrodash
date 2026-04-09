"use client";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { AlertTriangle, Bug, CloudLightning, MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import BentoCard from "@/components/ui/BentoCard";

const tooltipStyle = {
  borderRadius: "1.5rem",
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  fontSize: 12,
};

function RiskLevel({ area }: { area: number }) {
  if (area >= 2)
    return (
      <span className="animate-pulse rounded-[1rem] bg-red-100 px-2.5 py-0.5 text-[10px] font-black text-red-600">
        CRITICAL
      </span>
    );
  if (area >= 1)
    return (
      <span className="rounded-[1rem] bg-orange-100 px-2.5 py-0.5 text-[10px] font-black text-orange-500">
        HIGH
      </span>
    );
  if (area > 0)
    return (
      <span className="rounded-[1rem] bg-yellow-100 px-2.5 py-0.5 text-[10px] font-black text-yellow-600">
        MODERATE
      </span>
    );
  return (
    <span className="rounded-[1rem] bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-400">
      LOW
    </span>
  );
}

function riskDot(area: number) {
  if (area >= 2) return "bg-red-500";
  if (area >= 1) return "bg-orange-400";
  if (area > 0) return "bg-yellow-400";
  return "bg-slate-200";
}

function TrendIndicator({ trend }: { trend: "increasing" | "decreasing" | "stable" }) {
  if (trend === "increasing")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
        <TrendingUp size={13} /> Increasing
      </span>
    );
  if (trend === "decreasing")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
        <TrendingDown size={13} /> Decreasing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
      <Minus size={13} /> Stable
    </span>
  );
}

export default function DamageRiskMonitoring() {
  const {
    damageRiskData, damageByCommodity, totalDamagedArea,
    damageByBarangay, mostAffectedBarangay, damagePercentage,
    affectedFarmerCount, damageTrend,
  } = useAgriData();

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

  if (damageRiskData.length === 0) {
    return (
      <BentoCard className="fade-up delay-1">
        <div className="py-14 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <AlertTriangle size={28} className="text-slate-300" />
          </div>
          <h3 className="mb-1 text-base font-extrabold text-slate-500">No Damage Reports</h3>
          <p className="mx-auto max-w-sm text-sm font-medium text-slate-400">
            When damage from pests, diseases, or calamities is recorded, analysis will appear here.
          </p>
        </div>
      </BentoCard>
    );
  }

  const mostAffectedDamage = mostAffectedBarangay !== "None" ? +(damageByBarangay[mostAffectedBarangay] ?? 0).toFixed(2) : 0;

  return (
    <div className="space-y-8">
      {/* Banner */}
      {mostAffectedBarangay !== "None" && (
        <div className="fade-up bg-red-50/70 backdrop-blur-xl border border-red-200/50 rounded-[2.5rem] p-8 shadow-xl shadow-red-100/30">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                <MapPin size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Most Affected Barangay</p>
                <p className="text-xl font-black text-red-700">{mostAffectedBarangay}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-8 text-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Total Damage</p>
                <p className="font-mono font-black text-red-600">{mostAffectedDamage} ha</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Affected Farmers</p>
                <p className="font-mono font-black text-red-600">{affectedFarmerCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">% of Planting Area</p>
                <p className="font-mono font-black text-red-600">{damagePercentage}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 cards */}
      <div className="grid gap-8 lg:grid-cols-3">
        <BentoCard title="Damaged Area" subtitle="Hectares by commodity" icon={AlertTriangle} className="fade-up delay-1">
          <p className="mb-1 font-mono text-3xl font-black text-red-500">{totalDamagedArea} ha</p>
          <div className="mb-1"><TrendIndicator trend={damageTrend} /></div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{damagePercentage}% of total planting area</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={damageByCommodity} barSize={22} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ha`, "Damage"]} />
              <Bar dataKey="area" radius={[0, 8, 8, 0]}>
                {damageByCommodity.map((e) => (
                  <Cell key={e.name} fill={COMMODITY_COLORS[e.name] || "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BentoCard>

        <BentoCard title="Pests & Diseases" subtitle="By commodity" icon={Bug} className="fade-up delay-2">
          <div className="space-y-4">
            {Object.entries(pestMap).map(([comm, pests]) => (
              <div key={comm}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COMMODITY_COLORS[comm] }} />
                  <span className="text-xs font-bold text-slate-600">{comm}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {pests.map((p) => (
                    <span key={p} className="rounded-[1rem] bg-orange-50 px-3 py-1 text-[10px] font-bold text-orange-600">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </BentoCard>

        <BentoCard title="Calamities" subtitle="Critical zones" icon={CloudLightning} className="fade-up delay-3">
          <div className="mb-5 space-y-2.5">
            {Object.entries(calamityMap).map(([comm, cals]) => (
              <div key={comm} className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 w-28 shrink-0">{comm}</span>
                {cals.map((c) => (
                  <span key={c} className="rounded-[1rem] bg-yellow-50 px-3 py-1 text-[10px] font-bold text-yellow-700">{c}</span>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Top Damaged</p>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {damageRiskData.slice(0, 8).map((r) => {
                const totalDmg = r.damage_pests_hectares + r.damage_calamity_hectares;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl bg-white/50 backdrop-blur border border-white/30 px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${riskDot(totalDmg)}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{r.barangay}</p>
                        <p className="text-[10px] text-slate-400">
                          {r.commodity} · {r.sub_category}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RiskLevel area={totalDmg} />
                      <span className="font-mono text-[10px] font-bold text-slate-500">{totalDmg} ha</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
