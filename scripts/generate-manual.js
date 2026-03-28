const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  LevelFormat,
  convertInchesToTwip,
} = require("docx");
const fs = require("fs");
const path = require("path");

const GREEN = "16A34A";
const GRAY = "6B7280";
const WHITE = "FFFFFF";
const BLACK = "000000";
const FONT = "Arial";
const OUTPUT = path.join(__dirname, "..", "Raze_AgroDash_System_Manual.docx");

// ── Helpers ──────────────────────────────────────────────────────────────────

function heading(text, level, opts = {}) {
  return new Paragraph({
    heading: level,
    spacing: { before: opts.before || 240, after: opts.after || 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        bold: true,
        color: GREEN,
        size: opts.size || (level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22),
      }),
    ],
    ...(opts.pageBreakBefore ? { pageBreakBefore: true } : {}),
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size || 24,
        bold: opts.bold,
        color: opts.color || BLACK,
        italics: opts.italics,
      }),
    ],
  });
}

function bulletList(items) {
  return items.map(
    (item) =>
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: item, font: FONT, size: 24 })],
      })
  );
}

function makeTableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          shading: isHeader
            ? { type: ShadingType.CLEAR, color: "auto", fill: GREEN }
            : undefined,
          width: { size: 0, type: WidthType.AUTO },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: String(text),
                  font: FONT,
                  size: 20,
                  bold: isHeader,
                  color: isHeader ? WHITE : BLACK,
                }),
              ],
            }),
          ],
        })
    ),
  });
}

function makeTable(headers, rows) {
  return new Table({
    width: { size: 9600, type: WidthType.DXA },
    rows: [
      makeTableRow(headers, true),
      ...rows.map((r) => makeTableRow(r)),
    ],
  });
}

function spacer(twips = 120) {
  return new Paragraph({ spacing: { before: twips, after: 0 }, children: [] });
}

// ── Cover Page ───────────────────────────────────────────────────────────────

const coverPage = [
  new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "\uD83C\uDF3E", font: FONT, size: 72 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "RAZE AGRODASH", font: FONT, size: 96, bold: true, color: GREEN })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: "System Manual & User Guide", font: FONT, size: 56, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: "Municipal Agriculture Production Monitoring System", font: FONT, size: 44 })] }),
  spacer(300),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: "Prepared for: Daniel Daagdag", font: FONT, size: 44 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "LGU Tubo, Abra \u2014 Region CAR", font: FONT, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "Version 6.0 | March 2026", font: FONT, size: 36, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "https://razeapp.site", font: FONT, size: 36, color: GREEN })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Table of Contents ────────────────────────────────────────────────────────

const tocSection = [
  heading("Table of Contents", HeadingLevel.HEADING_1),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Section 1: Introduction ──────────────────────────────────────────────────

const sec1 = [
  heading("1. Introduction", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("1.1 What is Raze AgroDash?", HeadingLevel.HEADING_2),
  para("Raze AgroDash is a web-based agricultural production monitoring system designed to centralize commodity data collection and reporting across the 10 barangays of the Municipality of Tubo, Abra. It serves as the primary digital tool for the Municipal Agriculture Office to track planting, harvesting, damage, and farmer registration data in one unified platform."),
  heading("1.2 Purpose", HeadingLevel.HEADING_2),
  para("The system was built to replace manual spreadsheet-based workflows with a modern, real-time dashboard. It enables the Municipal Agriculture Office to monitor production volumes, identify damage hotspots, compare barangay performance, and generate reports instantly rather than waiting for manual consolidation of paper records."),
  heading("1.3 Access", HeadingLevel.HEADING_2),
  para("Raze AgroDash is accessible from any modern web browser (Chrome, Firefox, Edge, Safari) by navigating to razeapp.site. No application installation is required. The system is optimized for both desktop and mobile devices, allowing field officers to enter data directly from the barangay."),
  heading("1.4 Real-Time Data Sync", HeadingLevel.HEADING_2),
  para("All data is stored in a cloud-hosted Supabase database. When any user adds, edits, or deletes a record, the changes are synchronized across all connected sessions instantly. This means the Municipal Agriculture Office always sees the latest data without needing to request updates from barangay officers."),
];

// ── Section 2: Getting Started ───────────────────────────────────────────────

const sec2 = [
  heading("2. Getting Started", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("2.1 Login Steps", HeadingLevel.HEADING_2),
  ...bulletList([
    "Step 1: Open any web browser and navigate to razeapp.site",
    "Step 2: Enter your assigned username and password on the login screen",
    "Step 3: The dashboard will load automatically based on your assigned role",
  ]),
  spacer(),
  para("Note: Default login credentials are provided separately by the Super Admin for security purposes. Do not share your credentials with anyone.", { italics: true, color: GRAY }),
  heading("2.2 Account Allocation", HeadingLevel.HEADING_2),
  para("The system supports a maximum of 20 user accounts distributed as follows:"),
  spacer(),
  makeTable(
    ["Account Type", "Count", "Description"],
    [
      ["Super Admin", "1", "Full system access and user management"],
      ["Admin", "2", "Cross-barangay data access and exports"],
      ["Barangay Officer", "10", "One per barangay, own-data access only"],
    ]
  ),
];

// ── Section 3: User Roles & Permissions ──────────────────────────────────────

const sec3 = [
  heading("3. User Roles & Permissions", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("Raze AgroDash uses a role-based access control system with three distinct roles. The following table details the permissions available to each role:"),
  spacer(),
  makeTable(
    ["Permission", "Barangay User", "Admin", "Super Admin"],
    [
      ["View own barangay data", "Yes", "Yes", "Yes"],
      ["Update own barangay data", "Yes", "Yes", "Yes"],
      ["View all 10 barangays", "No", "Yes", "Yes"],
      ["Update any barangay", "No", "Yes", "Yes"],
      ["Manage user accounts", "No", "No", "Yes"],
      ["View audit / export", "No", "Yes", "Yes"],
      ["System configuration", "No", "No", "Yes"],
    ]
  ),
  spacer(),
  para("The system supports a maximum of 20 total seats across all roles."),
];

// ── Section 4: Dashboard Overview ────────────────────────────────────────────

const sec4 = [
  heading("4. Dashboard Overview", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("4.1 KPI Cards", HeadingLevel.HEADING_2),
  para("The top of the dashboard displays five key performance indicator cards providing an at-a-glance summary of agricultural activity:"),
  ...bulletList([
    "Total Farmers: the number of registered farmers across all accessible barangays",
    "Total Production (MT): aggregate production in metric tons",
    "Planting Area: total hectares currently planted",
    "Damaged Area: total hectares reported as damaged",
    "Top Commodity: the commodity with the highest production volume",
  ]),
  heading("4.2 Daily Summary Calendar", HeadingLevel.HEADING_2),
  para("The calendar provides two viewing modes for tracking data entry activity:"),
  ...bulletList([
    "Monthly View: displays a full calendar month with green badges on days that have recorded data entries",
    "Weekly View: shows seven day columns with individual record cards for quick scanning",
    "Side Panel: clicking any day opens a side panel showing that day's summary grouped by barangay",
  ]),
  heading("4.3 Charts & Visualizations", HeadingLevel.HEADING_2),
  ...bulletList([
    "Production by Commodity: a bar chart comparing production volumes across all commodity categories",
    "Share of Production: a pie chart showing the percentage contribution of each commodity",
    "Sub-Category Breakdown: a tabbed interface to select a commodity and view detailed sub-category metrics",
  ]),
  heading("4.4 Barangay Leaderboard", HeadingLevel.HEADING_2),
  para("The leaderboard ranks all 10 barangays by total production volume. The table is sortable by different columns to allow quick comparison of barangay performance across various metrics."),
];

// ── Section 5: Managing Commodity Records ────────────────────────────────────

const sec5 = [
  heading("5. Managing Commodity Records", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("5.1 Commodity Categories", HeadingLevel.HEADING_2),
  para("The system tracks five commodity categories: Rice, Corn, Fishery, High Value Crops (HVC), and Industrial Crops. Each category uses a dynamic form that shows or hides fields based on the selected commodity type."),
  heading("5.2 Dynamic Form Fields", HeadingLevel.HEADING_2),
  makeTable(
    ["Field", "Rice", "Corn", "Fishery", "HVC", "Industrial"],
    [
      ["Planting Area", "Yes", "Yes", "Hidden", "Yes", "Yes"],
      ["Harvest Bags", "Yes", "Yes", "Hidden", "Optional", "Optional"],
      ["Damage", "Optional", "Optional", "Hidden", "Optional", "Optional"],
      ["Stocking", "Hidden", "Hidden", "Yes", "Hidden", "Hidden"],
      ["Fishery Harvest", "Hidden", "Hidden", "Yes", "Hidden", "Hidden"],
    ]
  ),
  heading("5.3 Adding a Record", HeadingLevel.HEADING_2),
  ...bulletList([
    "Click the Add Record button on the dashboard or records page",
    "Select the commodity category from the dropdown",
    "Fill in the required fields (the form adapts based on category selection)",
    "Click Submit to save the record",
    "The dialog stays open for rapid entry of multiple records and shows a success toast on each save",
  ]),
  heading("5.4 Editing and Deleting Records", HeadingLevel.HEADING_2),
  ...bulletList([
    "Edit: Click the Edit button on any record row to open the edit form with pre-filled values",
    "Delete: Click the Delete button on any record, then confirm the deletion in the confirmation dialog",
  ]),
];

// ── Section 6: Managing Farmers ──────────────────────────────────────────────

const sec6 = [
  heading("6. Managing Farmers", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("6.1 Farmer Registry", HeadingLevel.HEADING_2),
  para("The Farmer Registry displays a grid of 10 barangay summary cards. Each card shows the barangay name, total registered farmer count, and a male/female gender breakdown."),
  heading("6.2 Viewing Farmer Details", HeadingLevel.HEADING_2),
  ...bulletList([
    "Click any barangay card to open a modal with a scrollable list of all farmers in that barangay",
    "Click an individual farmer to view their detail record: name, gender, barangay, and registration date",
    "Edit and Delete buttons are available within the detail view",
  ]),
  heading("6.3 Registering a New Farmer", HeadingLevel.HEADING_2),
  ...bulletList([
    "Click the Register Farmer button in the page header or inside the barangay modal",
    "Fill in the farmer's name, gender, and barangay assignment",
    "The system will warn if a duplicate name is detected in the same barangay",
    "Click Save to register the farmer",
  ]),
];

// ── Section 7: Management Tab ────────────────────────────────────────────────

const sec7 = [
  heading("7. Management Tab (Admin Only)", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("The Management tab is accessible only to Admin and Super Admin users. It provides a centralized view for overseeing all 10 barangays."),
  heading("7.1 Barangay Cards", HeadingLevel.HEADING_2),
  para("Each barangay is represented by a card displaying mini KPI summaries including total records, production, planting area, and damage figures. Click any card to drill down into that barangay's detailed commodity records."),
  heading("7.2 Direct Data Editing", HeadingLevel.HEADING_2),
  para("Admins can directly edit commodity records from any barangay within the management view, enabling corrections and data quality assurance without needing to log in as a barangay user."),
  heading("7.3 Stale Data Alerts", HeadingLevel.HEADING_2),
  ...bulletList([
    "Orange badge: appears when a barangay has not submitted data in 7 or more days",
    "Red badge: appears when a barangay has no data at all",
  ]),
  para("These visual indicators help admins quickly identify barangays that may need follow-up or assistance with data entry."),
];

// ── Section 8: Damage & Risk Monitoring ──────────────────────────────────────

const sec8 = [
  heading("8. Damage & Risk Monitoring", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  heading("8.1 Most Affected Barangay", HeadingLevel.HEADING_2),
  para("A prominent red banner highlights the barangay with the highest total damage area. This enables the office to quickly focus resources and attention on the most affected area."),
  heading("8.2 Damage Breakdown", HeadingLevel.HEADING_2),
  ...bulletList([
    "Damage by Commodity: shows which crop types have sustained the most damage",
    "Pests & Diseases vs Calamity: separate charts distinguish between pest/disease damage and natural calamity damage",
  ]),
  heading("8.3 Severity Levels", HeadingLevel.HEADING_2),
  makeTable(
    ["Severity", "Threshold", "Indicator"],
    [
      ["CRITICAL", "2+ hectares damaged", "Red highlight"],
      ["HIGH", "1+ hectares damaged", "Orange highlight"],
      ["MODERATE", "Below 1 hectare", "Yellow highlight"],
    ]
  ),
  heading("8.4 Trend Indicators", HeadingLevel.HEADING_2),
  ...bulletList([
    "Increasing: red arrow pointing up, indicates damage is growing compared to the previous period",
    "Decreasing: green arrow pointing down, indicates damage is reducing",
    "Stable: no significant change between periods",
  ]),
];

// ── Section 9: Export & Reports ──────────────────────────────────────────────

const sec9 = [
  heading("9. Export & Reports", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("Admin and Super Admin users can generate various export formats from the Export tab. The following table lists all available export options:"),
  spacer(),
  makeTable(
    ["Export", "What It Contains"],
    [
      ["Records CSV", "All commodity records across barangays (no farmer names included)"],
      ["Farmers CSV", "Complete list of all registered farmers with details"],
      ["Monthly Summary", "Production and damage data grouped by month and barangay"],
      ["Quarterly Summary", "Production and damage data grouped by quarter and barangay"],
      ["Yearly Summary", "Production and damage data grouped by year and barangay"],
      ["Barangay Summary", "All-time cumulative totals per barangay"],
      ["Summary Report", "Printable HTML report formatted for presentation or filing"],
    ]
  ),
];

// ── Section 10: User Management ──────────────────────────────────────────────

const sec10 = [
  heading("10. User Management (Super Admin Only)", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("The User Management section is exclusively available to the Super Admin account. It provides oversight and control over all system accounts."),
  heading("10.1 User List", HeadingLevel.HEADING_2),
  para("The Users tab displays all 13 accounts (1 Super Admin, 2 Admins, and 10 Barangay Officers) with their role assignments and status."),
  heading("10.2 Password Management", HeadingLevel.HEADING_2),
  ...bulletList([
    "Reset Password: The Super Admin can reset any user's password using the Reset Password button next to each user entry",
    "Self-service: All users can change their own password through the sidebar menu, without requiring Super Admin intervention",
  ]),
];

// ── Section 11: 10 Barangays Reference ───────────────────────────────────────

const sec11 = [
  heading("11. 10 Barangays Reference", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("The following table lists all 10 barangays served by the system along with their assigned login usernames:"),
  spacer(),
  makeTable(
    ["Barangay", "Username", "Role"],
    [
      ["Supo", "supo", "Barangay User"],
      ["Poblacion", "poblacion", "Barangay User"],
      ["Wayangan", "wayangan", "Barangay User"],
      ["Kili", "kili", "Barangay User"],
      ["Tiempo", "tiempo", "Barangay User"],
      ["Amtuagan", "amtuagan", "Barangay User"],
      ["Tabacda", "tabacda", "Barangay User"],
      ["Alangtin", "alangtin", "Barangay User"],
      ["Dilong", "dilong", "Barangay User"],
      ["Tubtuba", "tubtuba", "Barangay User"],
    ]
  ),
];

// ── Section 12: Quick Reference Card ─────────────────────────────────────────

function refBox(title, canItems, cannotItems) {
  return [
    heading(title, HeadingLevel.HEADING_3, { before: 160 }),
    para("CAN:", { bold: true, color: GREEN }),
    ...canItems.map(
      (item) =>
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 20, after: 20 },
          children: [new TextRun({ text: item, font: FONT, size: 22 })],
        })
    ),
    para("CANNOT:", { bold: true, color: "DC2626" }),
    ...cannotItems.map(
      (item) =>
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 20, after: 20 },
          children: [new TextRun({ text: item, font: FONT, size: 22 })],
        })
    ),
  ];
}

const sec12 = [
  heading("12. Quick Reference Card", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  ...refBox(
    "Barangay User",
    ["View own barangay data", "Add commodity entries", "Edit own records", "Change own password"],
    ["See other barangays' data", "Access admin panel", "Export all data", "Manage users"]
  ),
  ...refBox(
    "Admin",
    ["View all 10 barangays", "Edit any barangay entry", "Export reports", "See stale data alerts"],
    ["Create or delete user accounts", "System configuration"]
  ),
];

// ── Section 13: Troubleshooting & FAQ ────────────────────────────────────────

const sec13 = [
  heading("13. Troubleshooting & FAQ", HeadingLevel.HEADING_1, { pageBreakBefore: true }),
  para("Below are answers to the most commonly encountered issues:"),
  ...bulletList([
    "Can't log in: Double-check the spelling of your username. Passwords are case-sensitive. Contact the Super Admin for a password reset if needed.",
    "Can't see other barangays: This is normal behavior for Barangay User accounts. Only Admin and Super Admin roles can view data from all 10 barangays.",
    "Data not showing on the dashboard: Verify your internet connection is active, then refresh the page. Data requires an active connection to sync from Supabase.",
    "Forgot password: Contact the Super Admin who can reset your password from the User Management panel.",
    "Page loading slowly: Check your internet connection speed. Try clearing your browser cache (Ctrl+Shift+Delete) and reloading the page.",
    "Need a new account: Contact the Super Admin. The system supports a maximum of 20 user accounts total.",
  ]),
];

// ── Build Document ───────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
              },
            },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24 },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: { font: FONT, size: 32, bold: true, color: GREEN },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        run: { font: FONT, size: 26, bold: true, color: GREEN },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        run: { font: FONT, size: 22, bold: true, color: GREEN },
        paragraph: { spacing: { before: 160, after: 80 } },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 },
              },
              children: [
                new TextRun({
                  text: "Raze AgroDash System Manual v6.0",
                  font: FONT,
                  size: 18,
                  color: GREEN,
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Municipal Agriculture Office, Tubo, Abra \u00B7 Region CAR",
                  font: FONT,
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  text: "    |    Page ",
                  font: FONT,
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: FONT,
                  size: 16,
                  color: GRAY,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...coverPage,
        ...tocSection,
        ...sec1,
        ...sec2,
        ...sec3,
        ...sec4,
        ...sec5,
        ...sec6,
        ...sec7,
        ...sec8,
        ...sec9,
        ...sec10,
        ...sec11,
        ...sec12,
        ...sec13,
      ],
    },
  ],
});

// ── Generate ─────────────────────────────────────────────────────────────────

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Document generated: ${OUTPUT}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
