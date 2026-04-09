const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TabStopType, TabStopPosition,
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "16A34A", type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })],
  });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 20, bold: opts.bold, color: opts.color })] })],
  });
}

function versionSection(version, date, title, changes) {
  const items = [];
  items.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${version} \u2014 ${title}`, font: "Arial" })] }));
  items.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: `Released: ${date}`, font: "Arial", size: 20, color: "666666", italics: true })],
  }));

  for (const category of Object.keys(changes)) {
    items.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: category, font: "Arial", size: 22, bold: true, color: "16A34A" })],
    }));
    for (const item of changes[category]) {
      items.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 40 },
        children: [new TextRun({ text: item, font: "Arial", size: 20 })],
      }));
    }
  }

  items.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  return items;
}

// ── Build Document ─────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1A2E1A" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "16A34A", space: 4 } },
          children: [
            new TextRun({ text: "Raze AgroDash", font: "Arial", size: 18, bold: true, color: "16A34A" }),
            new TextRun({ text: "\tVersion History & Changelog", font: "Arial", size: 18, color: "999999" }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 } },
          children: [
            new TextRun({ text: "Municipal Agriculture Office \u2014 City of Baguio \u2014 Region CAR", font: "Arial", size: 16, color: "999999" }),
            new TextRun({ text: "\tPage ", font: "Arial", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        })],
      }),
    },
    children: [
      // ── TITLE PAGE ─────────────────────────────────────────────────
      new Paragraph({ spacing: { before: 2400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "\uD83C\uDF3E", size: 72 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "RAZE AGRODASH", font: "Arial", size: 48, bold: true, color: "16A34A" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Version History & Changelog", font: "Arial", size: 28, color: "666666" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Municipal Agriculture Production Monitoring System", font: "Arial", size: 22, color: "888888" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Document Version: 1.0  |  Last Updated: March 28, 2026", font: "Arial", size: 20, color: "AAAAAA" })],
      }),

      // Quick reference table
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "Current Release: v4.0  |  Total Versions: 4", font: "Arial", size: 22, bold: true, color: "333333" })],
      }),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 2340, 2340, 2340],
        rows: [
          new TableRow({ children: [
            headerCell("Version", 2340), headerCell("Date", 2340), headerCell("Codename", 2340), headerCell("Status", 2340),
          ]}),
          new TableRow({ children: [
            cell("v1.0", 2340, { bold: true }), cell("March 28, 2026", 2340), cell("Foundation", 2340), cell("Deployed", 2340, { color: "16A34A" }),
          ]}),
          new TableRow({ children: [
            cell("v2.0", 2340, { bold: true, shading: "F9F9F9" }), cell("March 28, 2026", 2340, { shading: "F9F9F9" }), cell("Dynamic Data", 2340, { shading: "F9F9F9" }), cell("Deployed", 2340, { color: "16A34A", shading: "F9F9F9" }),
          ]}),
          new TableRow({ children: [
            cell("v3.0", 2340, { bold: true }), cell("March 28, 2026", 2340), cell("Smart Dashboard", 2340), cell("Deployed", 2340, { color: "16A34A" }),
          ]}),
          new TableRow({ children: [
            cell("v4.0", 2340, { bold: true, shading: "F0FAF0" }), cell("March 28, 2026", 2340, { shading: "F0FAF0" }), cell("Secure Access", 2340, { shading: "F0FAF0" }), cell("Current", 2340, { color: "16A34A", bold: true, shading: "F0FAF0" }),
          ]}),
        ],
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── VERSION 1.0 ────────────────────────────────────────────────
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Changelog", font: "Arial" })] }),

      ...versionSection("v1.0", "March 28, 2026", "Foundation", {
        "Dashboard Core": [
          "Built the base dashboard with Next.js 16, React 19, TailwindCSS 4, and Recharts",
          "5 KPI stat cards: Total Farmers, Total Production (MT), Planting Area, Damaged Area, Top Commodity",
          "Production by Commodity bar chart + Share of Production pie chart",
          "Sub-category breakdown with tabbed commodity selector (Rice/Corn/Fishery/HVC/Industrial)",
        ],
        "Data Structure": [
          "60 hardcoded AgriRecord entries across 10 barangays (Baguio City)",
          "5 commodity categories with document-accurate sub-types per Section 4.1",
          "Rice: Hybrid, Inbred, Traditional | Corn: single commodity | Fishery: 10 species",
          "High Value Crops: 13 varieties | Industrial Crops: Sugarcane",
        ],
        "Tabs & Navigation": [
          "4 tabs: Overview, Damage & Risk, Farmers, Records",
          "Responsive sidebar with mobile hamburger menu",
          "Damage & Risk monitoring: damage by commodity, pests & diseases, calamities & critical zones",
          "Farmer Distribution: gender pie chart + farmers per commodity bar chart",
          "Records: searchable, filterable, paginated table with 12 records per page",
        ],
        "Branding": [
          "Named 'Raze AgroDash' with green theme, Leaf icon, Space Mono headings",
          "Municipal Agriculture Office, City of Baguio, Region CAR footer",
          "FY 2024 Data badge",
        ],
      }),

      // ── VERSION 2.0 ────────────────────────────────────────────────
      ...versionSection("v2.0", "March 28, 2026", "Dynamic Data", {
        "CRUD System": [
          "Replaced all 60 hardcoded records with dynamic localStorage-based state management",
          "React Context (AgriDataProvider) with full CRUD: addRecord, updateRecord, deleteRecord",
          "All derived statistics (KPIs, charts) computed as useMemo values from live data",
          "Data persists across page refreshes via localStorage",
        ],
        "Dynamic Commodity Forms": [
          "RecordFormDialog with category-specific field visibility per Section 4.5",
          "Fishery: hides Planting Area & Harvest bags, shows Stocking & Fishery Harvest",
          "Corn: hides Variety dropdown (auto-fills 'Corn')",
          "All other categories: full field set with validation",
          "DeleteConfirmDialog for safe record removal",
        ],
        "Management Tab (5th tab)": [
          "Barangay-centric management view with left panel (10 barangay cards) + right panel (detail)",
          "Per-barangay mini KPIs: farmers, production bags, hectares",
          "Commodity records table with inline Edit/Delete actions",
          "Add Entry button pre-fills selected barangay",
        ],
        "Barangay Update": [
          "Replaced 10 Baguio barangays with: Supo, Poblacion, Wayangan, Kili, Tiempo, Amtuagan, Tabacda, Alangtin, Dilong, Tubtuba",
          "Old localStorage data auto-migrated (invalid barangays filtered out)",
        ],
        "Farmer Registry": [
          "New Farmer type: id, name, gender (Male/Female), barangay, timestamps",
          "Full farmer CRUD: Register, Edit, Delete with FarmerFormDialog",
          "FarmerRegistry component: searchable table with gender/barangay filters, pagination",
          "Farmers tab now shows registry as primary view + collapsible analytics charts",
          "farmer_ids array on AgriRecord links farmers to commodity entries",
          "FarmerSelectDialog: multi-select farmers from registry when adding commodity records",
          "Farmer counts (male/female/total) auto-computed from linked farmer IDs",
          "Cascade delete: removing a farmer unlinks them from all records and recomputes counts",
        ],
      }),

      // ── VERSION 3.0 ────────────────────────────────────────────────
      ...versionSection("v3.0", "March 28, 2026", "Smart Dashboard", {
        "Daily Summary Calendar": [
          "Month-view calendar grid on Overview tab with navigation arrows",
          "Days with submissions show green count badges",
          "Today highlighted with green ring",
          "Click any day to open a centered modal popup with full day detail",
          "Modal groups records by barangay with per-barangay stats (entries, farmers, bags)",
          "Quick-add buttons per barangay: '+ Farmer' and '+ Record' (pre-fills barangay)",
          "Commodity tags shown per barangay section",
          "Empty state with 'Add a record for this day' prompt",
        ],
        "Barangay Leaderboard": [
          "Ranked list of all 10 barangays on Overview tab",
          "Sortable by: Production (bags), Farmers, Entries, Area (ha)",
          "Color-coded rank badges: gold #1, silver #2, bronze #3",
          "Progress bars + mini stat columns per barangay",
          "Auto-hides when no data exists",
        ],
        "Export to CSV/PDF": [
          "Export dropdown button in the header bar",
          "Records CSV: downloads all commodity records with all fields",
          "Farmers CSV: downloads all registered farmers",
          "Summary Report (Print): opens formatted HTML report with stats + tables for printing",
        ],
        "Stale Data Alerts": [
          "Red 'No Data' badge on barangay cards with zero submissions",
          "Orange 'Stale' badge for barangays with no submissions in 7+ days",
          "Red/orange border highlights on affected barangay cards in Management tab",
          "Shows last update date per barangay",
          "staleBarangays derived stat added to context",
        ],
      }),

      // ── VERSION 4.0 ────────────────────────────────────────────────
      ...versionSection("v4.0", "March 28, 2026", "Secure Access", {
        "Role-Based Login System": [
          "Login page with Raze AgroDash branding, username/password authentication",
          "3 roles: Super Admin, Admin, Barangay User",
          "AuthProvider context with localStorage session persistence",
          "Login/logout with error handling for invalid credentials",
        ],
        "Pre-Made Accounts (13 total)": [
          "1 Super Admin: superadmin / admin123 (full access)",
          "2 Admins: admin1, admin2 / admin123 (all data, all tabs)",
          "10 Barangay Users: supo, poblacion, wayangan, kili, tiempo, amtuagan, tabacda, alangtin, dilong, tubtuba / user123",
        ],
        "Role-Based Data Filtering": [
          "Barangay Users see ONLY their own barangay's records, farmers, and statistics",
          "All KPI cards, charts, calendar, and tables automatically scoped to user's barangay",
          "visibleRecords/visibleFarmers computed in context based on current user role",
          "Admins and Super Admin see all 10 barangays' data",
        ],
        "Role-Based UI Gating": [
          "Barangay Users: 4 tabs (no Management), no Export button, no Leaderboard",
          "Admins/Super Admin: all 5 tabs, Export button, Leaderboard visible",
          "Header subtitle shows 'Barangay Portal' for barangay users, 'Production Monitoring System' for admins",
          "Sidebar shows user name, role badge (color-coded: red Super Admin, purple Admin, green Barangay)",
          "Sign Out button in sidebar footer",
        ],
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ── FUTURE VERSIONS ────────────────────────────────────────────
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Planned / Future Versions", font: "Arial" })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "The following features are planned for future releases. Add new versions below as they are developed.", font: "Arial", size: 20, color: "666666" })] }),

      ...versionSection("v5.0", "TBD", "(Planned)", {
        "Potential Features": [
          "User Management panel for Super Admin (create/delete accounts, assign roles)",
          "Audit log viewer (track who submitted/edited what, when)",
          "Password change functionality for all users",
          "Real-time data sync (if backend is added)",
          "Monthly/quarterly report generation",
          "Data backup and restore functionality",
          "Mobile-optimized data entry forms",
          "Notification system for stale data alerts",
          "Year-over-year comparison charts",
          "Barangay performance scoring/grading system",
        ],
      }),

      // ── TEMPLATE SECTION ───────────────────────────────────────────
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Version Template", font: "Arial" })] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Copy this template when adding a new version entry:", font: "Arial", size: 20, color: "666666", italics: true })] }),

      new Paragraph({
        spacing: { before: 160 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 } },
        shading: { fill: "F8F8F8", type: ShadingType.CLEAR },
        children: [new TextRun({ text: "v[X.X] \u2014 [Version Title]", font: "Arial", size: 22, bold: true })],
      }),
      new Paragraph({
        border: { left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 } },
        shading: { fill: "F8F8F8", type: ShadingType.CLEAR },
        children: [new TextRun({ text: "Released: [Date]", font: "Arial", size: 20, color: "888888", italics: true })],
      }),
      new Paragraph({
        border: { left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 } },
        shading: { fill: "F8F8F8", type: ShadingType.CLEAR },
        children: [new TextRun({ text: "[Category Name]: [Change description]", font: "Arial", size: 20, color: "888888" })],
      }),
    ],
  }],
});

const path = require("path");
const outputPath = path.join(__dirname, "..", "Raze_AgroDash_Version_History.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Document created: " + outputPath);
});
