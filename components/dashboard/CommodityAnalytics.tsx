"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { useAgriData } from "@/lib/agri-context";
import { COMMODITY_COLORS } from "@/lib/data";
import BentoCard from "@/components/ui/BentoCard";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

const tooltipStyle = {
  borderRadius: "1.5rem",
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  fontSize: 12,
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
};

const CustomTooltipBar = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={tooltipStyle} className="p-3">
        <p className="font-bold text-slate-700">{label}</p>
        <p className="text-slate-500">
          <span className="font-mono font-black" style={{ color: label ? COMMODITY_COLORS[label] : undefined }}>
            {payload[0].value.toLocaleString()}
          </span>{" "}
          bags
        </p>
        <p className="text-slate-400 text-xs mt-1">
          {(payload[0].value * 0.04).toFixed(1)} MT
        </p>
      </div>
    );
  }
  return null;
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
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
      <BentoCard variant="compact" className="fade-up delay-1">
        <p className="py-10 text-center text-sm font-bold text-slate-400">No production data yet. Add commodity records to see analytics.</p>
      </BentoCard>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <BentoCard
        variant="compact"
        title="Production by Commodity"
        subtitle="Output in bags (40 kg each)"
        icon={BarChart3}
        className="fade-up delay-1 lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barSize={36} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Space Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltipBar />} cursor={{ fill: "rgba(16,185,129,0.04)" }} />
            <Bar dataKey="bags" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COMMODITY_COLORS[entry.name] || "#10b981"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </BentoCard>

      <BentoCard
        variant="compact"
        title="Share of Production"
        subtitle="% of total output"
        icon={PieChartIcon}
        className="fade-up delay-2"
      >
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="bags" nameKey="name" cx="50%" cy="48%" outerRadius={88} labelLine={false} label={renderCustomLabel}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COMMODITY_COLORS[entry.name] || "#10b981"} />
              ))}
            </Pie>
            <Legend formatter={(value) => <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{value}</span>} iconSize={10} iconType="circle" />
            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} bags`, "Production"]} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </BentoCard>
    </div>
  );
}
