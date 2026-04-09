# Raze AgroDash — Project Memory

> Living document tracking project context, decisions, and notes.
> Last updated: April 9, 2026

## Project Overview

**Raze AgroDash** is a municipal agricultural production monitoring system built for **LGU Tubo, Abra (CAR)**. It tracks crop production, damage, farmer registrations, and generates reports for the Municipal Agriculture Office.

- **Live URL**: https://razeapp.site
- **GitHub**: https://github.com/Razeflow/raze-agrodash
- **Current Version**: v7.0 (UI Redesign — Enterprise Light Theme)

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js 16 (App Router)** | Server-side rendering, file-based routing, and React Server Components for the dashboard shell |
| **Supabase** | Managed Postgres + realtime subscriptions + auth — avoids running a custom backend |
| **Client-side data context** | `AgriDataProvider` with Supabase realtime subscriptions keeps the dashboard live without polling |
| **Tailwind v4 (CDN-free via PostCSS)** | Utility-first CSS with proper build-time extraction |
| **Recharts** | Lightweight React charting library that integrates naturally with the component model |
| **Radix UI primitives** | Accessible, unstyled dialog/select/tabs components |
| **Role-based auth (3 tiers)** | `SUPER_ADMIN` > `ADMIN` > `BARANGAY_USER` — barangay users see only their own data |

## Domain Model

- **10 Barangays**: Supo, Poblacion, Wayangan, Kili, Tiempo, Amtuagan, Tabacda, Alangtin, Dilong, Tubtuba
- **5 Commodity Categories**: Rice (Hybrid/Inbred/Traditional), Corn, Fishery (10 species), High Value Crops (13 varieties), Industrial Crops (Sugarcane)
- **Units**: Production in 40kg bags, area in hectares

## Data Flow

1. Auth via Supabase `profiles` table (role-based)
2. `AgriDataProvider` fetches `agri_records` and `farmers` tables on login
3. Realtime subscriptions auto-sync changes across devices
4. Visible data scoped by user role (`visibleRecords` / `visibleFarmers`)
5. All KPIs, charts, and tables derive from the context via `useMemo`

## Version History

| Version | Codename | Key Changes |
|---------|----------|-------------|
| v1.0 | Foundation | Base dashboard, 5 KPIs, hardcoded data |
| v2.0 | Dynamic Data | CRUD, localStorage, farmer registry |
| v3.0 | Smart Dashboard | Calendar, leaderboard, CSV/PDF export |
| v4.0 | Secure Access | Role-based login, 13 pre-made accounts |
| v5.0 | Supabase Backend | Migrated from localStorage to Supabase |
| v6.0 | Multi-User | Realtime sync, concurrent users |
| v7.0 | UI Redesign | Glassmorphic enterprise light theme |

## Known Limitations / Tech Debt

- `generate-changelog.js` produces a DOCX only — no markdown changelog
- `lib/auth.ts` still has demo account definitions (legacy from pre-Supabase era)
- No automated tests
- No CI/CD pipeline
- Password reset requires service_role key (server-side only, not yet implemented)
- Stale data detection uses client-side timestamp (approximate)

## Environment Setup

Required env vars in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

For setup scripts, also need:
```
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```
