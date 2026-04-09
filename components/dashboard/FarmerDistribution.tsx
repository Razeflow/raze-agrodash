"use client";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { Users } from "lucide-react";
import FarmerRegistry from "./FarmerRegistry";
import BentoCard from "@/components/ui/BentoCard";

const GENDER_COLORS = ["#0284c7", "#ec4899"];

const tooltipStyle = {
  borderRadius: "1.5rem",
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  fontSize: 12,
};

export default function FarmerDistribution() {
  const { totalFarmers, farmersByCommodity } = useAgriData();
  const { male, female } = totalFarmers;

  const genderData = [
    { name: "Male", value: male },
    { name: "Female", value: female },
  ];

  return (
    <div className="space-y-8">
      <FarmerRegistry />

      {farmersByCommodity.length > 0 && (
        <BentoCard title="Farmer Analytics" subtitle="Gender distribution & commodity breakdown" icon={Users} collapsible defaultExpanded={false}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Gender Pie */}
            <div className="rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-5">
              <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Gender Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {genderData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
                  </Pie>
                  <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{v}</span>} iconSize={10} iconType="circle" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-blue-50/50 backdrop-blur border border-blue-100/50 p-3">
                  <p className="font-mono text-xl font-black text-blue-600">{male.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Male</p>
                </div>
                <div className="rounded-2xl bg-pink-50/50 backdrop-blur border border-pink-100/50 p-3">
                  <p className="font-mono text-xl font-black text-pink-500">{female.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Female</p>
                </div>
              </div>
            </div>

            {/* Farmers by commodity */}
            <div className="lg:col-span-2 rounded-2xl bg-white/50 backdrop-blur border border-white/30 p-5">
              <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Farmers per Commodity</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={farmersByCommodity} barSize={18} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="male" name="Male" fill="#0284c7" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="female" name="Female" fill="#ec4899" radius={[6, 6, 0, 0]} />
                  <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{v}</span>} iconType="circle" iconSize={8} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                {farmersByCommodity.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-1.5 text-xs font-bold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COMMODITY_COLORS[c.name] }} />
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-mono font-black" style={{ color: COMMODITY_COLORS[c.name] }}>{c.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </BentoCard>
      )}
    </div>
  );
}
