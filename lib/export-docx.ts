import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun,
  ShadingType, Header, Footer, PageNumber,
  convertMillimetersToTwip,
} from "docx";
import type { AgriRecord, Farmer } from "./data";
import { BARANGAYS, COMMODITY_COLORS } from "./data";

// ── Types for the export function ─────────────────────────────────────────────
type ExportData = {
  records: AgriRecord[];
  farmers: Farmer[];
  totalFarmers: { male: number; female: number; total: number };
  totalProduction: { bags: number; tons: number };
  totalPlantingArea: number;
  totalDamagedArea: number;
  mostProducedCommodity: string;
  productionByCommodity: { name: string; bags: number; tons: number }[];
  damageByCommodity: { name: string; area: number }[];
};

// ── Canvas chart renderers ────────────────────────────────────────────────────
function renderBarChart(
  data: { label: string; value: number; color: string }[],
  title: string,
  unit: string,
  width = 600,
  height = 300
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Chart area
  const padding = { top: 50, right: 30, bottom: 70, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Title
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 28);

  if (data.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return canvasToUint8Array(canvas);
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(50, (chartW / data.length) * 0.6);
  const gap = (chartW - barWidth * data.length) / (data.length + 1);

  // Grid lines
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + chartH - (chartH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    const val = ((maxVal * i) / gridLines).toFixed(0);
    ctx.fillText(val, padding.left - 8, y + 3);
  }

  // Bars
  data.forEach((d, i) => {
    const x = padding.left + gap + i * (barWidth + gap);
    const barH = (d.value / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Bar
    ctx.fillStyle = d.color;
    ctx.beginPath();
    const radius = 4;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, padding.top + chartH);
    ctx.lineTo(x, padding.top + chartH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();

    // Value label on top
    ctx.fillStyle = "#374151";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${d.value.toLocaleString()} ${unit}`, x + barWidth / 2, y - 6);

    // X-axis label
    ctx.fillStyle = "#6b7280";
    ctx.font = "9px Arial";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartH + 12);
    ctx.rotate(-0.4);
    ctx.fillText(d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label, 0, 0);
    ctx.restore();
  });

  // Axes
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(width - padding.right, padding.top + chartH);
  ctx.stroke();

  return canvasToUint8Array(canvas);
}

function renderPieChart(
  data: { label: string; value: number; color: string }[],
  title: string,
  width = 500,
  height = 300
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 24);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    ctx.fillStyle = "#999";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return canvasToUint8Array(canvas);
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const centerX = width / 2 - 80;
  const centerY = height / 2 + 10;
  const radius = Math.min(width, height) / 2 - 50;

  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += sliceAngle;
  });

  // Legend
  const legendX = width / 2 + 40;
  let legendY = 50;
  data.forEach((d) => {
    ctx.fillStyle = d.color;
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = "#374151";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    const pct = ((d.value / total) * 100).toFixed(1);
    ctx.fillText(`${d.label} (${pct}%)`, legendX + 18, legendY + 10);
    legendY += 22;
  });

  return canvasToUint8Array(canvas);
}

function canvasToUint8Array(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}

// ── Table helpers ─────────────────────────────────────────────────────────────
const BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
};

function headerCell(text: string, widthPc?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, font: "Arial", color: "1a1a1a" })],
      spacing: { before: 40, after: 40 },
    })],
    shading: { type: ShadingType.SOLID, color: "f0faf0" },
    borders: BORDER,
    width: widthPc ? { size: widthPc, type: WidthType.PERCENTAGE } : undefined,
  });
}

function dataCell(text: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, font: "Arial", color: "374151" })],
      alignment: align,
      spacing: { before: 30, after: 30 },
    })],
    borders: BORDER,
  });
}

function numCell(value: number | string): TableCell {
  return dataCell(typeof value === "number" ? value.toLocaleString() : value, AlignmentType.RIGHT);
}

// ── Main export function ──────────────────────────────────────────────────────
export async function generateDocxReport(data: ExportData): Promise<void> {
  const {
    records, farmers, totalFarmers, totalProduction,
    totalPlantingArea, totalDamagedArea, mostProducedCommodity,
    productionByCommodity, damageByCommodity,
  } = data;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Render charts ──────────────────────────────────────────────────────
  const productionChartData = productionByCommodity.map((c) => ({
    label: c.name,
    value: c.bags,
    color: COMMODITY_COLORS[c.name] || "#888",
  }));
  const productionChartImg = renderBarChart(productionChartData, "Production by Commodity (bags)", "bags");

  const damageChartData = damageByCommodity.filter((d) => d.area > 0).map((d) => ({
    label: d.name,
    value: d.area,
    color: COMMODITY_COLORS[d.name] || "#dc2626",
  }));
  const damageChartImg = renderBarChart(damageChartData, "Damaged Area by Commodity (hectares)", "ha");

  // Per-barangay production chart
  const barangayProdData = BARANGAYS.map((b) => {
    const brgyRecords = records.filter((r) => r.barangay === b);
    return {
      label: b,
      value: brgyRecords.reduce((s, r) => s + r.harvesting_output_bags, 0),
      color: "#16a34a",
    };
  });
  const barangayProdChart = renderBarChart(barangayProdData, "Production by Barangay (bags)", "bags", 700, 320);

  // Farmer distribution pie chart
  const farmerPieData = [
    { label: "Male", value: totalFarmers.male, color: "#3b82f6" },
    { label: "Female", value: totalFarmers.female, color: "#ec4899" },
  ];
  const farmerPieChart = renderPieChart(farmerPieData, "Farmer Gender Distribution");

  // Commodity distribution pie
  const commodityPieData = productionByCommodity.map((c) => ({
    label: c.name,
    value: c.bags,
    color: COMMODITY_COLORS[c.name] || "#888",
  }));
  const commodityPieChart = renderPieChart(commodityPieData, "Production Distribution by Commodity");

  // ── Build document ─────────────────────────────────────────────────────
  const sections = [];

  // ── SECTION 1: TITLE & KPI ─────────────────────────────────────────────
  const kpiChildren: (Paragraph | Table)[] = [
    // Title
    new Paragraph({
      children: [new TextRun({ text: "RAZE AgroDash", bold: true, size: 48, font: "Arial", color: "16a34a" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Agricultural Production Monitoring System", size: 24, font: "Arial", color: "6b7280" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Municipality of Tubo, Abra · Region CAR", size: 20, font: "Arial", color: "9ca3af" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Summary Report — ${dateStr}`, bold: true, size: 22, font: "Arial", color: "374151" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),

    // KPI heading
    new Paragraph({
      text: "Key Performance Indicators",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 150 },
    }),

    // KPI table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell("Metric", 50),
            headerCell("Value", 50),
          ],
        }),
        new TableRow({ children: [dataCell("Total Records"), numCell(records.length)] }),
        new TableRow({ children: [dataCell("Total Farmers"), numCell(`${totalFarmers.total} (${totalFarmers.male}M / ${totalFarmers.female}F)`)] }),
        new TableRow({ children: [dataCell("Total Production"), numCell(`${totalProduction.bags.toLocaleString()} bags (${totalProduction.tons} MT)`)] }),
        new TableRow({ children: [dataCell("Total Planting Area"), numCell(`${totalPlantingArea} hectares`)] }),
        new TableRow({ children: [dataCell("Total Damaged Area"), numCell(`${totalDamagedArea} hectares`)] }),
        new TableRow({ children: [dataCell("Damage Percentage"), numCell(`${totalPlantingArea > 0 ? ((totalDamagedArea / totalPlantingArea) * 100).toFixed(1) : 0}%`)] }),
        new TableRow({ children: [dataCell("Top Commodity"), numCell(mostProducedCommodity)] }),
        new TableRow({ children: [dataCell("Active Barangays"), numCell(`${new Set(records.map((r) => r.barangay)).size} of ${BARANGAYS.length}`)] }),
      ],
    }),

    // Gender distribution chart
    new Paragraph({ text: "", spacing: { before: 200 } }),
    new Paragraph({
      children: [
        new ImageRun({ data: farmerPieChart, transformation: { width: 450, height: 270 }, type: "png" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
    }),
  ];

  sections.push({
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(20),
          bottom: convertMillimetersToTwip(20),
          left: convertMillimetersToTwip(20),
          right: convertMillimetersToTwip(20),
        },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: "Raze AgroDash — Agricultural Summary Report", italics: true, size: 16, font: "Arial", color: "9ca3af" })],
          alignment: AlignmentType.RIGHT,
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Page ", size: 16, font: "Arial", color: "9ca3af" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "9ca3af" }),
            new TextRun({ text: ` — Generated ${dateStr}`, size: 16, font: "Arial", color: "9ca3af" }),
          ],
          alignment: AlignmentType.CENTER,
        })],
      }),
    },
    children: kpiChildren,
  });

  // ── SECTION 2: PRODUCTION ANALYTICS ────────────────────────────────────
  const analyticsChildren: (Paragraph | Table)[] = [
    new Paragraph({
      text: "Production Analytics",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 100, after: 150 },
    }),

    // Commodity production table
    new Paragraph({
      text: "Production by Commodity",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 100, after: 100 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [headerCell("Commodity"), headerCell("Bags (40kg)"), headerCell("Metric Tons")],
        }),
        ...productionByCommodity.map((c) =>
          new TableRow({
            children: [dataCell(c.name), numCell(c.bags), numCell(c.tons.toFixed(2))],
          })
        ),
      ],
    }),

    // Production bar chart
    new Paragraph({
      children: [
        new ImageRun({ data: productionChartImg, transformation: { width: 520, height: 260 }, type: "png" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 150, after: 100 },
    }),

    // Commodity pie chart
    new Paragraph({
      children: [
        new ImageRun({ data: commodityPieChart, transformation: { width: 450, height: 270 }, type: "png" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
    }),

    // Barangay production chart
    new Paragraph({
      text: "Production by Barangay",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 100, after: 100 },
    }),
    new Paragraph({
      children: [
        new ImageRun({ data: barangayProdChart, transformation: { width: 560, height: 260 }, type: "png" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
    }),
  ];

  // Damage section
  if (damageByCommodity.some((d) => d.area > 0)) {
    analyticsChildren.push(
      new Paragraph({
        text: "Damage & Risk Analysis",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [headerCell("Commodity"), headerCell("Damaged Area (ha)")],
          }),
          ...damageByCommodity.filter((d) => d.area > 0).map((d) =>
            new TableRow({
              children: [dataCell(d.name), numCell(d.area.toFixed(2))],
            })
          ),
        ],
      }),
      new Paragraph({
        children: [
          new ImageRun({ data: damageChartImg, transformation: { width: 520, height: 260 }, type: "png" }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 150, after: 200 },
      }),
    );
  }

  sections.push({ children: analyticsChildren });

  // ── SECTION 3: PER-BARANGAY DETAIL ─────────────────────────────────────
  for (const brgy of BARANGAYS) {
    const brgyRecords = records.filter((r) => r.barangay === brgy);
    const brgyFarmers = farmers.filter((f) => f.barangay === brgy);
    const brgyBags = brgyRecords.reduce((s, r) => s + r.harvesting_output_bags, 0);
    const brgyArea = brgyRecords.reduce((s, r) => s + r.planting_area_hectares, 0);
    const brgyDmg = brgyRecords.reduce((s, r) => s + r.damage_pests_hectares + r.damage_calamity_hectares, 0);
    const brgyMale = brgyFarmers.filter((f) => f.gender === "Male").length;
    const brgyFemale = brgyFarmers.filter((f) => f.gender === "Female").length;

    // Per-barangay commodity chart
    const commodityBreakdown: Record<string, number> = {};
    brgyRecords.forEach((r) => { commodityBreakdown[r.commodity] = (commodityBreakdown[r.commodity] || 0) + r.harvesting_output_bags; });
    const brgyCommodityData = Object.entries(commodityBreakdown).map(([name, bags]) => ({
      label: name,
      value: bags,
      color: COMMODITY_COLORS[name] || "#888",
    }));
    const brgyCommodityChart = renderBarChart(brgyCommodityData, `${brgy} — Production by Commodity`, "bags", 520, 260);

    const brgyChildren: (Paragraph | Table)[] = [
      new Paragraph({
        text: `Barangay ${brgy}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 100, after: 150 },
      }),

      // Barangay summary table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [headerCell("Metric"), headerCell("Value")] }),
          new TableRow({ children: [dataCell("Registered Farmers"), numCell(`${brgyFarmers.length} (${brgyMale}M / ${brgyFemale}F)`)] }),
          new TableRow({ children: [dataCell("Commodity Records"), numCell(brgyRecords.length)] }),
          new TableRow({ children: [dataCell("Total Harvest"), numCell(`${brgyBags.toLocaleString()} bags (${(brgyBags * 0.04).toFixed(2)} MT)`)] }),
          new TableRow({ children: [dataCell("Planting Area"), numCell(`${brgyArea.toFixed(2)} ha`)] }),
          new TableRow({ children: [dataCell("Damaged Area"), numCell(`${brgyDmg.toFixed(2)} ha`)] }),
        ],
      }),
    ];

    // Commodity chart
    if (brgyCommodityData.length > 0) {
      brgyChildren.push(
        new Paragraph({
          children: [
            new ImageRun({ data: brgyCommodityChart, transformation: { width: 480, height: 240 }, type: "png" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 150, after: 100 },
        }),
      );
    }

    // Commodity records table
    if (brgyRecords.length > 0) {
      brgyChildren.push(
        new Paragraph({
          text: "Commodity Records",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 80 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell("Commodity"),
                headerCell("Variety"),
                headerCell("Farmers"),
                headerCell("Area (ha)"),
                headerCell("Harvest"),
                headerCell("Damage (ha)"),
              ],
            }),
            ...brgyRecords.map((r) => {
              const dmg = r.damage_pests_hectares + r.damage_calamity_hectares;
              return new TableRow({
                children: [
                  dataCell(r.commodity),
                  dataCell(r.sub_category),
                  numCell(r.total_farmers),
                  numCell(r.commodity === "Fishery" ? "—" : r.planting_area_hectares.toFixed(2)),
                  numCell(r.commodity === "Fishery" ? `${r.harvesting_fishery} (fish)` : r.harvesting_output_bags.toLocaleString()),
                  numCell(dmg > 0 ? dmg.toFixed(2) : "—"),
                ],
              });
            }),
          ],
        }),
      );
    }

    // Farmer roster
    if (brgyFarmers.length > 0) {
      brgyChildren.push(
        new Paragraph({
          text: "Farmer Roster",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 80 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [headerCell("#"), headerCell("Name"), headerCell("Gender"), headerCell("Registered")],
            }),
            ...brgyFarmers.map((f, i) =>
              new TableRow({
                children: [
                  numCell(i + 1),
                  dataCell(f.name),
                  dataCell(f.gender),
                  dataCell(new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })),
                ],
              })
            ),
          ],
        }),
      );
    }

    sections.push({ children: brgyChildren });
  }

  // ── Build & download ───────────────────────────────────────────────────
  const doc = new Document({
    creator: "Raze AgroDash",
    title: "Agricultural Summary Report",
    description: `Summary report generated on ${dateStr}`,
    sections,
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AgroDash_Summary_Report_${now.toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
