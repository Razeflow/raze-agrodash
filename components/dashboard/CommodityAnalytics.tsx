"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";

const CustomTooltipBar = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-700">{label}</p>
        <p className="text-gray-500">
          <span className="font-mono font-bold" style={{ color: COMMODITY_COLORS[label] }}>
            {payload[0].value.toLocaleString()}
          </span>{" "}
          bags
        </p>
        <p className="text-gray-400 text-xs">
          ≈ {(payload[0].value * 0.04).toFixed(1)} MT
        </p>
      </div>
    );
  }
  return null;
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return percent > 0.05 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

export default function CommodityAnalytics({ barangayFilter }: { barangayFilter?: string }) {
  const { productionByCommodity, records } = useAgriData();
  const isFiltered = barangayFilter && barangayFilter !== "All";

  const data = isFiltered
    ? (() => {
        const t: Record<string, number> = {};
        records.filter((r) => r.barangay === barangayFilter).forEach((r) => {
          t[r.commodity] = (t[r.commodity] || 0) + r.harvesting_output_bags;
        });
        return Object.entries(t).map(([name, bags]) => ({ name, bags, tons: +(bags * 0.04).toFixed(2) }));
      })()
    : productionByCommodity;

  if (data.length === 0) {
    return (
      <div className="fade-up delay-1 rounded-2xl border border-green-100 bg-white p-10 shadow-sm text-center">
        <p className="text-sm text-gray-400">No production data yet. Add commodity records to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="fade-up delay-1 lg:col-span-2 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-400">
          Production by Commodity
        </h2>
        <p className="mb-4 text-xs text-gray-400">Output in bags (40 kg each)</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barSize={36} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#888", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltipBar />} cursor={{ fill: "#f0f8f0" }} />
            <Bar dataKey="bags" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COMMODITY_COLORS[entry.name] || "#16a34a"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="fade-up delay-2 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-400">
          Share of Production
        </h2>
        <p className="mb-2 text-xs text-gray-400">% of total output</p>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="bags" nameKey="name" cx="50%" cy="48%" outerRadius={88} labelLine={false} label={renderCustomLabel}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COMMODITY_COLORS[entry.name] || "#16a34a"} />
              ))}
            </Pie>
            <Legend formatter={(value) => <span style={{ fontSize: 11, color: "#555" }}>{value}</span>} iconSize={10} iconType="circle" />
            <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} bags`, "Production"]} contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
