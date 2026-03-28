"use client";
import { useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import { ChevronDown, ChevronUp } from "lucide-react";
import FarmerRegistry from "./FarmerRegistry";

const GENDER_COLORS = ["#0284c7", "#ec4899"];

export default function FarmerDistribution() {
  const { totalFarmers, farmersByCommodity } = useAgriData();
  const { male, female } = totalFarmers;
  const [showAnalytics, setShowAnalytics] = useState(false);

  const genderData = [
    { name: "Male", value: male },
    { name: "Female", value: female },
  ];

  return (
    <div className="space-y-5">
      {/* Primary: Farmer Registry */}
      <FarmerRegistry />

      {/* Secondary: Analytics toggle */}
      {farmersByCommodity.length > 0 && (
        <div className="rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 transition"
          >
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Farmer Analytics</h3>
              <p className="text-xs text-gray-400">Gender distribution & commodity breakdown</p>
            </div>
            {showAnalytics ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showAnalytics && (
            <div className="grid gap-4 p-5 pt-0 lg:grid-cols-3">
              {/* Gender Pie */}
              <div className="rounded-xl border border-gray-100 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Gender Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {genderData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
                    </Pie>
                    <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#555" }}>{v}</span>} iconSize={10} iconType="circle" />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [v.toLocaleString(), ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-blue-50 p-2">
                    <p className="font-mono text-lg font-bold text-blue-600">{male.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Male</p>
                  </div>
                  <div className="rounded-xl bg-pink-50 p-2">
                    <p className="font-mono text-lg font-bold text-pink-500">{female.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Female</p>
                  </div>
                </div>
              </div>

              {/* Farmers by commodity bar */}
              <div className="lg:col-span-2 rounded-xl border border-gray-100 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Farmers per Commodity</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={farmersByCommodity} barSize={18} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#888", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="male" name="Male" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="female" name="Female" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Legend formatter={(v) => <span style={{ fontSize: 11, color: "#555" }}>{v}</span>} iconType="circle" iconSize={8} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap gap-2">
                  {farmersByCommodity.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: COMMODITY_COLORS[c.name] + "55" }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: COMMODITY_COLORS[c.name] }} />
                      <span className="text-gray-600">{c.name}</span>
                      <span className="font-mono font-bold" style={{ color: COMMODITY_COLORS[c.name] }}>{c.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
