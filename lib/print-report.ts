import type { AgriRecord, Farmer, Household } from "./data";
import { BARANGAYS, COMMODITY_COLORS, CALAMITY_SUB_CATEGORY_LABELS, numField } from "./data";
import {
  getBarangaySummary,
  getCapacitySummary,
  getCropMetrics,
  getDamageSummary,
  getFisheryMetrics,
  getLifecycleSummary,
  getLivestockMetrics,
  getProductionByCommodity,
  getTopCommodity,
  getRiskRanking,
} from "@/lib/domain/metrics";
import { formatAggregationMeta, getAggregationMeta } from "@/lib/domain/audit";

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportData = {
  records: AgriRecord[];
  farmers: Farmer[];
  households?: Household[];
};

type Period = "monthly" | "quarterly" | "yearly" | "full";

// ── SVG Chart Generators (inline in print) ───────────────────────────────────
function barChartSVG(
  data: { label: string; value: number; color: string }[],
  title: string,
  w = 560,
  h = 260
): string {
  if (data.length === 0 || data.every((d) => d.value === 0))
    return `<div style="text-align:center;color:#9ca3af;padding:24px;font-size:12px;">${title}: No data</div>`;

  const pad = { t: 40, r: 20, b: 60, l: 55 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(48, (cw / data.length) * 0.6);
  const gap = (cw - barW * data.length) / (data.length + 1);

  let bars = "";
  data.forEach((d, i) => {
    const x = pad.l + gap + i * (barW + gap);
    const barH = (d.value / max) * ch;
    const y = pad.t + ch - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${d.color}"/>`;
    bars += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" fill="#374151" font-size="9" font-weight="600">${d.value.toLocaleString()}</text>`;
    bars += `<text x="${x + barW / 2}" y="${pad.t + ch + 14}" text-anchor="middle" fill="#6b7280" font-size="8" transform="rotate(-25,${x + barW / 2},${pad.t + ch + 14})">${d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}</text>`;
  });

  // Grid
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (ch * i) / 4;
    grid += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" fill="#9ca3af" font-size="9">${((max * i) / 4).toFixed(0)}</text>`;
  }

  return `
    <div style="text-align:center;margin:16px 0;">
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;">
        <text x="${w / 2}" y="22" text-anchor="middle" fill="#1a1a1a" font-size="13" font-weight="bold">${title}</text>
        ${grid}
        <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ch}" stroke="#d1d5db" stroke-width="1.5"/>
        <line x1="${pad.l}" y1="${pad.t + ch}" x2="${w - pad.r}" y2="${pad.t + ch}" stroke="#d1d5db" stroke-width="1.5"/>
        ${bars}
      </svg>
    </div>`;
}

function pieChartSVG(
  data: { label: string; value: number; color: string }[],
  title: string,
  size = 220
): string {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0)
    return `<div style="text-align:center;color:#9ca3af;padding:16px;font-size:12px;">${title}: No data</div>`;

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2 + 16;
  const r = size / 2 - 30;
  let startAngle = -Math.PI / 2;
  let paths = "";

  filtered.forEach((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${d.color}" stroke="#fff" stroke-width="2"/>`;
    startAngle = endAngle;
  });

  const legend = filtered.map((d) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#374151;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${d.color};flex-shrink:0;"></span>
      ${d.label} (${pct}%)
    </div>`;
  }).join("");

  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:24px;margin:12px 0;">
      <svg width="${size}" height="${size + 24}" xmlns="http://www.w3.org/2000/svg">
        <text x="${cx}" y="14" text-anchor="middle" fill="#1a1a1a" font-size="12" font-weight="bold">${title}</text>
        ${paths}
      </svg>
      <div style="display:flex;flex-direction:column;gap:4px;">${legend}</div>
    </div>`;
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function tableHTML(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Filter records by period ─────────────────────────────────────────────────
function filterByPeriod(records: AgriRecord[], period: Period, refDate: Date): AgriRecord[] {
  if (period === "full") return records;

  const year = refDate.getFullYear();
  const month = refDate.getMonth();

  if (period === "monthly") {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return records.filter((r) => r.created_at.startsWith(prefix));
  }

  if (period === "quarterly") {
    const qStart = Math.floor(month / 3) * 3;
    const qEnd = qStart + 2;
    return records.filter((r) => {
      const m = parseInt(r.created_at.slice(5, 7), 10) - 1;
      const y = parseInt(r.created_at.slice(0, 4), 10);
      return y === year && m >= qStart && m <= qEnd;
    });
  }

  // yearly
  return records.filter((r) => r.created_at.startsWith(`${year}`));
}

function periodLabel(period: Period, refDate: Date): string {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  if (period === "monthly") return `${monthNames[month]} ${year}`;
  if (period === "quarterly") {
    const q = Math.floor(month / 3) + 1;
    const qStart = monthNames[Math.floor(month / 3) * 3];
    const qEnd = monthNames[Math.floor(month / 3) * 3 + 2];
    return `Q${q} ${year} (${qStart} – ${qEnd})`;
  }
  if (period === "yearly") return `Year ${year}`;
  return "Full Summary";
}

// ── Main HTML generator ──────────────────────────────────────────────────────
function generateReportHTML(data: ReportData, period: Period, refDate: Date): string {
  const { farmers, households } = data;
  const recs = filterByPeriod(data.records, period, refDate);
  const pLabel = periodLabel(period, refDate);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Compute stats (all via domain aggregators) ────────────────────────────
  const totalMale = recs.reduce((s, r) => s + r.farmer_male, 0);
  const totalFemale = recs.reduce((s, r) => s + r.farmer_female, 0);

  const crop = getCropMetrics(recs as any);
  const fishery = getFisheryMetrics(recs as any);
  const livestock = getLivestockMetrics(recs as any);
  const dmg = getDamageSummary(recs as any);
  const lifecycle = getLifecycleSummary(recs as any);
  const capacity = households ? getCapacitySummary(recs as any, households, farmers) : null;

  const cropBags = crop.harvestedBags;
  const cropTons = crop.harvestedMetricTons;
  const fisheryFish = fishery.harvestedPieces;
  const livestockHeads = livestock.outputHeads;

  const cropActiveArea = lifecycle.active.cropAreaHa;
  const cropDmgInSeasonHa = dmg.crop.damageHa;
  const cropDmgPctOfActive = dmg.crop.damagePctOfActive;

  const topCommodity = getTopCommodity(recs as any);
  const cropByCommodity = getProductionByCommodity(recs as any, "CROP");
  const fisheryByCommodity = getProductionByCommodity(recs as any, "FISHERY");
  const livestockByCommodity = getProductionByCommodity(recs as any, "LIVESTOCK");

  const barangaySummary = getBarangaySummary(recs as any, BARANGAYS);
  const riskRanking = getRiskRanking(recs as any, BARANGAYS);

  // Charts
  const cropProdChartData = cropByCommodity.map((r) => ({
    label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#888",
  }));
  const fisheryProdChartData = fisheryByCommodity.map((r) => ({
    label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#0284c7",
  }));
  const livestockProdChartData = livestockByCommodity.map((r) => ({
    label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#7c3aed",
  }));

  const brgyCropProdData = barangaySummary.map((b) => ({
    label: b.barangay, value: b.cropBags, color: "#16a34a",
  }));
  const brgyFisheryProdData = barangaySummary.map((b) => ({
    label: b.barangay, value: b.fisheryFish, color: "#0284c7",
  }));
  const brgyLivestockProdData = barangaySummary.map((b) => ({
    label: b.barangay, value: b.livestockHeads, color: "#7c3aed",
  }));

  const genderPieData = [
    { label: "Male", value: totalMale, color: "#3b82f6" },
    { label: "Female", value: totalFemale, color: "#ec4899" },
  ];

  const cropCommodityPieData = cropByCommodity.map((r) => ({
    label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#888",
  }));

  const cropDamageChartData = dmg.crop.byCommodity.map((r) => ({
    label: r.name, value: r.damageHa, color: COMMODITY_COLORS[r.name] || "#dc2626",
  }));

  // Build HTML sections
  let barangaySections = "";
  for (const bs of barangaySummary) {
    const brgyRecs = recs.filter((r) => r.barangay === bs.barangay);
    const brgyFarmerList = farmers.filter((f) => f.barangay === bs.barangay);
    if (brgyRecs.length === 0 && brgyFarmerList.length === 0) continue;

    const brgyCropCom = getProductionByCommodity(brgyRecs as any, "CROP");
    const brgyFishCom = getProductionByCommodity(brgyRecs as any, "FISHERY");
    const brgyLiveCom = getProductionByCommodity(brgyRecs as any, "LIVESTOCK");

    const brgyCropComData = brgyCropCom.map((r) => ({ label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#888" }));
    const brgyFishComData = brgyFishCom.map((r) => ({ label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#0284c7" }));
    const brgyLiveComData = brgyLiveCom.map((r) => ({ label: r.name, value: r.value, color: COMMODITY_COLORS[r.name] || "#7c3aed" }));

    const recordRows = brgyRecs.map((r) => {
      const dmgHa = numField(r.damage_pests_hectares) + numField(r.damage_calamity_hectares);
      const calType = r.calamity_sub_category === "None" ? "—" : CALAMITY_SUB_CATEGORY_LABELS[r.calamity_sub_category];
      const calEvt = r.calamity === "None" ? "—" : r.calamity;
      return [
        r.commodity, r.sub_category, String(r.total_farmers),
        r.commodity === "Fishery" ? "—" : r.planting_area_hectares.toFixed(2),
        r.commodity === "Fishery"
          ? `${numField(r.harvesting_fishery)} fish`
          : r.commodity === "Livestock"
            ? `${numField(r.livestock_output_heads)} heads`
            : numField(r.harvesting_output_bags).toLocaleString(),
        dmgHa > 0 ? dmgHa.toFixed(2) : "—",
        r.pests_diseases === "None" ? "—" : r.pests_diseases,
        calType,
        calEvt,
      ];
    });

    const farmerRows = brgyFarmerList.map((f, i) => [
      String(i + 1), f.name, f.gender,
      f.rsbsa_number || "—",
      new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    ]);

    barangaySections += `
      <div class="page-break"></div>
      <h2>Barangay ${bs.barangay}</h2>
      <div class="stats-row">
        <div class="stat"><strong>${brgyFarmerList.length}</strong>Farmers</div>
        <div class="stat"><strong>${brgyRecs.length}</strong>Records</div>
        <div class="stat"><strong>${bs.cropBags.toLocaleString()}</strong>Crop harvest (bags)</div>
        <div class="stat"><strong>${bs.fisheryFish.toLocaleString()}</strong>Fishery harvest (fish)</div>
        <div class="stat"><strong>${bs.livestockHeads.toLocaleString()}</strong>Livestock output (heads)</div>
        <div class="stat"><strong>${bs.cropActiveAreaHa.toFixed(1)} ha</strong>Active crop area</div>
        <div class="stat"><strong>${bs.cropDamageHa.toFixed(1)} ha</strong>Crop damage</div>
      </div>
      ${brgyCropComData.length > 0 ? barChartSVG(brgyCropComData, `${bs.barangay} — Crop production (bags)`, 520, 220) : ""}
      ${brgyFishComData.length > 0 ? barChartSVG(brgyFishComData, `${bs.barangay} — Fishery harvest (fish)`, 520, 220) : ""}
      ${brgyLiveComData.length > 0 ? barChartSVG(brgyLiveComData, `${bs.barangay} — Livestock output (heads)`, 520, 220) : ""}
      ${brgyRecs.length > 0 ? `<h3>Commodity Records</h3>${tableHTML(["Commodity", "Variety", "Farmers", "Area (ha)", "Harvest", "Damage (ha)", "Pests", "Calamity type", "Calamity event"], recordRows)}` : ""}
      ${brgyFarmerList.length > 0 ? `<h3>Farmer Roster</h3>${tableHTML(["#", "Name", "Gender", "RSBSA", "Registered"], farmerRows)}` : ""}
    `;
  }

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Raze AgroDash — ${pLabel}</title>
<style>
  @media print {
    .page-break { page-break-before: always; }
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #fff; }
  .container { max-width: 900px; margin: 0 auto; padding: 32px 40px; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #16a34a; padding-bottom: 20px; }
  .header h1 { font-size: 26px; color: #16a34a; margin: 0 0 4px; letter-spacing: 1px; }
  .header .subtitle { font-size: 13px; color: #6b7280; margin: 0 0 2px; }
  .header .period { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-top: 8px; }
  .header .date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #16a34a; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #15803d; }
  h2 { font-size: 18px; color: #16a34a; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #f0faf0; }
  h3 { font-size: 14px; color: #374151; margin: 16px 0 8px; }
  .stats-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
  .stat { flex: 1; min-width: 120px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; text-align: center; }
  .stat strong { display: block; font-size: 22px; color: #1a1a1a; font-family: 'Courier New', monospace; }
  .stat { font-size: 11px; color: #6b7280; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 16px 0; }
  .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; border-left: 4px solid #16a34a; }
  .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 600; }
  .kpi .value { font-size: 22px; font-weight: 700; color: #1a1a1a; font-family: 'Courier New', monospace; margin-top: 4px; }
  .kpi .sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
  th { background: #f0faf0; color: #1a1a1a; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #d1d5db; }
  td { padding: 6px 10px; border: 1px solid #e5e7eb; color: #374151; }
  tr:nth-child(even) { background: #fafafa; }
  .charts-row { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: flex-start; }
  .chart-card { flex: 1; min-width: 280px; }
  svg text { font-family: Arial, sans-serif; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
<div class="container">
  <div class="header">
    <h1>RAZE AgroDash</h1>
    <p class="subtitle">Agricultural Production Monitoring System</p>
    <p class="subtitle">Municipality of Tubo, Abra · Region CAR</p>
    <p class="period">${pLabel}</p>
    <p class="date">Generated: ${dateStr}</p>
  </div>

  <h2>Key Performance Indicators</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Total Records</div><div class="value">${recs.length}</div></div>
    <div class="kpi" style="border-left-color:#3b82f6"><div class="label">Total Farmers</div><div class="value">${totalMale + totalFemale}</div><div class="sub">${totalMale}M / ${totalFemale}F</div></div>
    <div class="kpi" style="border-left-color:#ca8a04"><div class="label">Crop production</div><div class="value">${cropBags.toLocaleString()}</div><div class="sub">${cropTons.toLocaleString()} MT (bags × 0.04)</div></div>
    <div class="kpi" style="border-left-color:#0284c7"><div class="label">Fishery harvest</div><div class="value">${fisheryFish.toLocaleString()}</div><div class="sub">fish (finalized harvest)</div></div>
    <div class="kpi" style="border-left-color:#7c3aed"><div class="label">Livestock output</div><div class="value">${livestockHeads.toLocaleString()}</div><div class="sub">heads (finalized output)</div></div>
    <div class="kpi" style="border-left-color:#0284c7"><div class="label">Active crop area</div><div class="value">${cropActiveArea.toFixed(1)}</div><div class="sub">hectares (active cycles)</div></div>
    <div class="kpi" style="border-left-color:#dc2626"><div class="label">Crop damage</div><div class="value">${cropDmgInSeasonHa.toFixed(1)}</div><div class="sub">ha (${cropDmgPctOfActive.toFixed(1)}% of active)</div></div>
    <div class="kpi" style="border-left-color:#9333ea"><div class="label">Top Commodity</div><div class="value" style="font-size:16px">${topCommodity}</div></div>
    ${capacity ? `<div class="kpi" style="border-left-color:#10b981"><div class="label">Capacity utilization</div><div class="value">${capacity.utilizationPct.toFixed(1)}%</div><div class="sub">${capacity.activeAllocatedHa.toFixed(1)} ha active / ${capacity.totalCapacityHa.toFixed(1)} ha capacity</div></div>` : ""}
  </div>

  <div class="charts-row">
    <div class="chart-card">${pieChartSVG(genderPieData, "Gender Distribution")}</div>
    <div class="chart-card">${pieChartSVG(cropCommodityPieData, "Crop Production Share (bags)")}</div>
  </div>

  <h2>Production Analytics</h2>
  <h3>Crops</h3>
  ${tableHTML(
    ["Commodity", "Bags (40kg)", "Metric Tons", "Share %"],
    cropByCommodity.map((r) => [
      r.name,
      r.value.toLocaleString(),
      (r.value * 0.04).toFixed(2),
      cropBags > 0 ? ((r.value / cropBags) * 100).toFixed(1) + "%" : "0%",
    ])
  )}
  ${barChartSVG(cropProdChartData, "Crop production by commodity (bags)")}
  ${barChartSVG(brgyCropProdData, "Crop production by barangay (bags)", 640, 280)}

  <h3>Fishery</h3>
  ${fisheryByCommodity.length > 0
    ? `${tableHTML(["Commodity", "Harvest (fish)"], fisheryByCommodity.map((r) => [r.name, r.value.toLocaleString()]))}
       ${barChartSVG(fisheryProdChartData, "Fishery harvest by commodity (fish)")}
       ${barChartSVG(brgyFisheryProdData, "Fishery harvest by barangay (fish)", 640, 280)}`
    : `<p style="color:#9ca3af;font-size:12px;">No fishery harvest in this period.</p>`
  }

  <h3>Livestock</h3>
  ${livestockByCommodity.length > 0
    ? `${tableHTML(["Commodity", "Output (heads)"], livestockByCommodity.map((r) => [r.name, r.value.toLocaleString()]))}
       ${barChartSVG(livestockProdChartData, "Livestock output by commodity (heads)")}
       ${barChartSVG(brgyLivestockProdData, "Livestock output by barangay (heads)", 640, 280)}`
    : `<p style="color:#9ca3af;font-size:12px;">No livestock output in this period.</p>`
  }

  <h2>Damage & Risk Analysis</h2>
  <h3>Crops (hectares)</h3>
  ${dmg.crop.byCommodity.length > 0
    ? `${tableHTML(
        ["Commodity", "Damage (ha)", "Finalized loss (ha)"],
        dmg.crop.byCommodity.map((r) => [r.name, r.damageHa.toFixed(2), "—"]),
      )}
       ${barChartSVG(cropDamageChartData, "Crop damaged area by commodity (ha)")}`
    : `<p style="color:#9ca3af;font-size:12px;">No crop damage logged in this period.</p>`
  }

  <h3>Fishery (lost fish)</h3>
  ${dmg.fishery.lossPieces > 0
    ? tableHTML(["Metric", "Value"], [["Loss", dmg.fishery.lossPieces.toLocaleString() + " fish"]])
    : `<p style="color:#9ca3af;font-size:12px;">No fishery loss finalized in this period.</p>`
  }

  <h3>Livestock (dead heads)</h3>
  ${dmg.livestock.deadHeads > 0
    ? tableHTML(["Metric", "Value"], [["Dead", dmg.livestock.deadHeads.toLocaleString() + " heads"]])
    : `<p style="color:#9ca3af;font-size:12px;">No livestock loss finalized in this period.</p>`
  }

  <h3>Risk ranking (worst severity per barangay)</h3>
  ${tableHTML(
    ["Barangay", "Severity", "Crop damage (ha)", "Fish loss", "Livestock dead", "Affected farmers"],
    riskRanking
      .filter((r) => r.severity !== "LOW")
      .slice(0, 12)
      .map((r) => [
        r.barangay,
        r.severity,
        r.cropDamageHa.toFixed(2),
        r.fisheryLossPieces.toLocaleString(),
        r.livestockDeadHeads.toLocaleString(),
        String(r.affectedFarmers),
      ]),
  )}

  <h2>Barangay Summary</h2>
  ${tableHTML(
    ["Barangay", "Records", "Farmers", "Crop harvest (bags)", "Fishery (fish)", "Livestock (heads)", "Active crop area (ha)", "Crop damage (ha)"],
    barangaySummary.map((b) => {
      const brgyFarmerCount = farmers.filter((f) => f.barangay === b.barangay).length;
      return [
        b.barangay,
        String(b.recordCount),
        String(brgyFarmerCount),
        b.cropBags.toLocaleString(),
        b.fisheryFish.toLocaleString(),
        b.livestockHeads.toLocaleString(),
        b.cropActiveAreaHa.toFixed(2),
        b.cropDamageHa.toFixed(2),
      ];
    })
  )}

  ${capacity ? `<h2>Capacity Utilization</h2>${tableHTML(
      ["Household", "Capacity (ha)", "Active (ha)", "Remaining (ha)", "Utilization %", "Overallocated"],
      capacity.perHousehold
        .sort((a, b) => b.utilizationPct - a.utilizationPct)
        .slice(0, 25)
        .map((h) => [
          h.householdId,
          h.capacityHa.toFixed(2),
          h.activeHa.toFixed(2),
          h.remainingHa.toFixed(2),
          h.utilizationPct.toFixed(1),
          h.overallocated ? "YES" : "",
        ])
    )}` : ""}

  ${barangaySections}

  <div style="margin-top:24px;color:#9ca3af;font-size:10px;">
    <div>${formatAggregationMeta(getAggregationMeta(crop))}</div>
    <div>${formatAggregationMeta(getAggregationMeta(dmg))}</div>
  </div>
</div>
</body></html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function openPrintableReport(data: ReportData, period: Period, refDate?: Date): void {
  const date = refDate || new Date();
  const html = generateReportHTML(data, period, date);
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
