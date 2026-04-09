# Raze AgroDash — Skills & Tech Reference

> Quick reference for the tech stack, patterns, and commands used in this project.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS (via PostCSS) | v4 |
| Backend/DB | Supabase (Postgres + Realtime) | ^2.100.1 |
| Charts | Recharts | ^3.8.1 |
| UI Primitives | Radix UI (Dialog, Select, Tabs, Slot) | latest |
| Icons | Lucide React | ^1.7.0 |
| Doc Generation | docx | ^9.6.1 |
| Utilities | clsx, tailwind-merge, class-variance-authority | latest |
| Linting | ESLint + eslint-config-next | ^9 |

## Project Structure

```
agri-dashboard/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Main dashboard (tabbed UI)
│   ├── globals.css         # Tailwind imports + custom styles
│   └── icon.svg            # Favicon
├── components/
│   ├── LoginPage.tsx       # Auth login screen
│   ├── providers.tsx       # AuthProvider + AgriDataProvider wrapper
│   ├── ui/
│   │   └── BentoCard.tsx   # Reusable card component
│   └── dashboard/          # All dashboard tab components
│       ├── KpiCards.tsx
│       ├── CommodityAnalytics.tsx
│       ├── DailySummaryCalendar.tsx
│       ├── BarangayLeaderboard.tsx
│       ├── DamageRiskMonitoring.tsx
│       ├── FarmerDistribution.tsx
│       ├── FarmerRegistry.tsx
│       ├── DataTable.tsx
│       ├── ManagementView.tsx
│       ├── UserManagement.tsx
│       ├── FindingMatrix.tsx
│       ├── SubCategoryAnalytics.tsx
│       ├── ExportButton.tsx
│       ├── RecordFormDialog.tsx
│       ├── FarmerFormDialog.tsx
│       ├── FarmerSelectDialog.tsx
│       ├── DeleteConfirmDialog.tsx
│       ├── PasswordChangeDialog.tsx
│       └── SeedButton.tsx
├── lib/
│   ├── data.ts             # Types, constants, barangays, commodities
│   ├── supabase.ts         # Supabase client init
│   ├── auth-context.tsx    # AuthProvider (login/logout/roles)
│   ├── agri-context.tsx    # AgriDataProvider (CRUD + realtime)
│   ├── auth.ts             # Legacy demo accounts
│   ├── utils.ts            # cn() utility
│   ├── export-docx.ts      # DOCX export logic
│   ├── print-report.ts     # Printable HTML report generator
│   └── seed-data.ts        # Demo data seeder
├── scripts/
│   ├── schema.sql          # Supabase table definitions
│   ├── setup-supabase.js   # One-time DB + user setup
│   ├── fix-rls.js          # Row-level security fixes
│   ├── generate-changelog.js  # DOCX changelog generator
│   └── generate-manual.js  # DOCX system manual generator
└── public/                 # Static assets
```

## Key Patterns

### State Management
- **React Context** for global state (no Redux/Zustand)
- `AuthProvider` wraps `AgriDataProvider` — auth must resolve before data loads
- All derived stats computed via `useMemo` from raw records/farmers arrays

### Role-Based Access
- Three roles: `SUPER_ADMIN`, `ADMIN`, `BARANGAY_USER`
- Data filtering happens in `AgriDataProvider` via `visibleRecords` / `visibleFarmers`
- UI gating via `isBarangayUser`, `isAdmin`, `isSuperAdmin` flags

### Supabase Integration
- Client created in `lib/supabase.ts` from env vars
- Realtime subscriptions in `agri-context.tsx` for `agri_records` and `farmers`
- Auth via `profiles` table (not Supabase Auth directly)

### Styling
- Glassmorphic design: `bg-white/50 backdrop-blur border border-white/30`
- Consistent spacing: `rounded-2xl`, `p-5`, `gap-6`
- Color tokens: emerald/green for primary, slate for text

## Commands

```bash
npm run dev       # Start dev server (port 3000)
npm run build     # Production build (TypeScript + Next.js)
npm run start     # Serve production build
npm run lint      # Run ESLint
npm run docs:sync # Sync documentation to Obsidian vault

# Scripts (run from project root)
node scripts/setup-supabase.js      # Initial DB setup (needs SUPABASE_SERVICE_ROLE_KEY)
node scripts/fix-rls.js             # Fix row-level security policies
node scripts/generate-changelog.js  # Generate DOCX changelog
node scripts/generate-manual.js     # Generate DOCX system manual
```

## Useful Patterns

### Adding a new component
1. Create in `components/dashboard/NewComponent.tsx`
2. Import in `app/page.tsx` and add to the appropriate tab
3. Use `useAgriData()` for data, `useAuth()` for role checks

### Adding a new commodity sub-type
1. Edit `SUB_TYPES` in `lib/data.ts`
2. The form and analytics will auto-adapt

### Adding a new barangay
1. Add to `BARANGAYS` array in `lib/data.ts`
2. Update Supabase schema if needed
3. Create a new user account via setup script
