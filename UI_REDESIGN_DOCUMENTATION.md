# Raze AgroDash — UI Redesign Documentation

**Date:** April 9, 2026  
**Version:** 2.0 (Premium Minimalist Glassmorphic)  
**Previous Style:** Clean Enterprise (Blue accent, flat cards, solid backgrounds)  
**New Style:** Premium Minimalist Glassmorphic (Emerald accent, glass cards, depth through blur & shadows)

---

## 1. Overview

The entire dashboard UI was overhauled from a flat enterprise blue theme to a premium minimalist glassmorphic design. The redesign affects **23 files** across the frontend — all visual/presentational changes only. No backend logic, data layer, authentication, or business rules were modified.

**Design Philosophy:** Minimalist but not flat. Depth is achieved through:
- Frosted glass (backdrop-blur) card surfaces
- Layered white transparency
- Elevated shadow systems with accent-tinted hover states
- Smooth 500ms transitions on all interactive elements

---

## 2. Design System Changes

### 2.1 Color Palette

| Token | Before | After |
|-------|--------|-------|
| Page background | `#eef5ff` (light blue) | `#F0F4F8` (neutral slate) |
| Card surface | `#ffffff` (solid white) | `rgba(255,255,255,0.70)` (translucent) |
| Card border | `#e6edf7` (blue-tinted) | `rgba(255,255,255,0.40)` (white glass) |
| Primary accent | `#2563eb` (blue-600) | `#10b981` (emerald-500) |
| Active navigation | Blue-tinted background | `bg-slate-950 text-white` (dark contrast) |
| Destructive | `#dc2626` (red-600) | `#dc2626` (unchanged) |

### 2.2 Typography

| Element | Before | After |
|---------|--------|-------|
| Page title | `text-2xl font-bold` | `text-4xl lg:text-5xl font-black tracking-tighter` |
| Card title | `text-lg font-semibold` | `text-xl font-extrabold tracking-tight` |
| Card subtitle/label | `text-xs text-gray-500` | `text-[10px] font-black uppercase tracking-widest text-slate-400` |
| Body text weight | `font-medium` / `font-semibold` | `font-bold` / `font-extrabold` |
| Monospace values | `font-mono` | `font-mono font-black` (Space Mono) |

### 2.3 Spacing & Radius

| Element | Before | After |
|---------|--------|-------|
| Card border-radius | `16px` (`rounded-2xl`) | `2.5rem` / `40px` (`rounded-[2.5rem]`) |
| Button border-radius | `rounded-lg` (8px) | `rounded-[1.5rem]` (24px) |
| Dialog border-radius | `rounded-xl` | `rounded-[2rem]` (32px) |
| Badge/pill radius | `rounded-full` | `rounded-[1rem]` (16px) |
| Card padding | `p-4` / `p-5` | `p-8` |
| Section gap | `gap-4` | `gap-6` / `gap-8` |

### 2.4 Shadow System

| State | Before | After |
|-------|--------|-------|
| Card default | `shadow-sm` | `shadow-xl shadow-slate-200/50` |
| Card hover | minimal change | `shadow-2xl shadow-emerald-100/50` |
| Button primary | `shadow` | `shadow-lg shadow-emerald-200` |
| Dialog | `shadow-lg` | `shadow-2xl` |

### 2.5 Glass Effects

All cards and dialogs now use:
```
background: rgba(255, 255, 255, 0.70)   /* translucent white */
backdrop-filter: blur(20px)              /* frosted glass */
border: 1px solid rgba(255, 255, 255, 0.40)  /* subtle white edge */
```

Dialogs use a slightly more opaque variant:
```
background: rgba(255, 255, 255, 0.92)
backdrop-filter: blur(20px)
```

Dialog overlays:
```
background: rgba(0, 0, 0, 0.25)
backdrop-filter: blur(4px)
```

---

## 3. New Components

### 3.1 BentoCard (`components/ui/BentoCard.tsx`) — NEW FILE

A shared reusable card component used by 15+ dashboard sections. Replaces inline card markup across all components.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Card heading |
| `subtitle` | `string` | Uppercase micro-label below title |
| `icon` | `LucideIcon` | Icon displayed in hover wrapper |
| `action` | `ReactNode` | Slot for dropdowns/buttons in header |
| `className` | `string` | Additional CSS classes |
| `noPadding` | `boolean` | Removes body padding (for tables) |
| `collapsible` | `boolean` | Enables expand/collapse toggle |
| `defaultExpanded` | `boolean` | Initial expanded state |

**Key behaviors:**
- Icon wrapper transitions to emerald on card hover (`group-hover:bg-emerald-600 group-hover:text-white`)
- Title transitions to emerald on hover (`group-hover:text-emerald-700`)
- Collapsible variant shows chevron toggle with smooth height animation
- Full card uses `transition-all duration-500` for shadow/hover effects

---

## 4. Layout Changes

### 4.1 Sidebar (`app/page.tsx`)

**Before:** Fixed tab bar in header with text pills  
**After:** Collapsible sidebar with hover expansion

| Feature | Detail |
|---------|--------|
| Collapsed width | `w-24` (icon-only) |
| Expanded width | `w-80` (on hover) |
| Expansion trigger | CSS `group/sidebar` + `group-hover/sidebar:` pattern |
| Content offset | `lg:pl-24` (sidebar overlays on expand, doesn't push content) |
| Logo | Emerald gradient (`from-emerald-500 to-teal-700`), Sprout icon, rotates on hover |
| Active nav item | `bg-slate-950 text-white` with emerald icon |
| Inactive nav item | `text-slate-500 hover:bg-white/50` |
| Floating tooltips | Shown when sidebar is collapsed, hidden when expanded |
| Profile section | Initials avatar, display name, role badge — hidden when collapsed |
| Mobile | Hamburger toggle, overlay sidebar |

### 4.2 Header (`app/page.tsx`)

**Before:** Compact header with tabs and inline actions  
**After:** Hero-style header

| Element | Style |
|---------|-------|
| Portal label | `text-[10px] font-black uppercase tracking-widest text-emerald-600` |
| Page title | `text-4xl lg:text-5xl font-black tracking-tighter text-slate-900` |
| Date | `text-slate-400 text-sm` with calendar icon |
| Export button | Glass pill: `bg-white/50 backdrop-blur border border-white/40 rounded-[1.5rem]` |

---

## 5. Component-by-Component Changes

### Phase 2: High-Impact Components

#### LoginPage.tsx
- Logo: Leaf icon replaced with Sprout icon
- Card: Solid white replaced with `bg-white/70 backdrop-blur-xl rounded-[2.5rem]`
- Inputs: `rounded-[1.5rem]` with emerald focus ring (`focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`)
- Submit button: `bg-emerald-600 rounded-[1.5rem] font-black shadow-xl shadow-emerald-200`
- Background gradient: Updated to emerald tints

#### KpiCards.tsx
- Removed colored left accent bars
- Added icon hover wrappers (`p-3 bg-white border rounded-2xl shadow-sm`)
- Icon wrappers transition to emerald on card hover
- Cards: `bg-white/70 backdrop-blur-xl border border-white/40 rounded-[2rem]`
- Shadow: `shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-emerald-100/50`

#### FindingMatrix.tsx
- Wrapped in `<BentoCard>` with `collapsible`, `defaultExpanded`, `noPadding` props
- Table headers: `text-[10px] font-black uppercase tracking-widest text-slate-400`
- Status cells: Updated bar colors to emerald spectrum
- Detail breakdown rows: `rounded-2xl bg-white/50 backdrop-blur border border-white/30`

### Phase 3: Dashboard Card Components

#### CommodityAnalytics.tsx
- Split into 2 BentoCards (bar chart + pie chart)
- Tooltip: Glass style with `backdrop-filter: blur(20px)`
- Grid gap increased to `gap-8`

#### SubCategoryAnalytics.tsx
- Wrapped in BentoCard with Warehouse icon
- Commodity filter pills: `rounded-[1.5rem]` with commodity-colored active shadows
- Inactive pills: `bg-white/50 border-white/40`

#### DamageRiskMonitoring.tsx
- 3 separate BentoCards (Damaged Area, Pests & Diseases, Calamities)
- Alert banner: `bg-red-50/70 backdrop-blur-xl border border-red-200/50 rounded-[2.5rem]`
- Risk badges: `rounded-[1rem] font-black text-[10px]`
- Damage list items: Colored dots replacing left border bars

#### DailySummaryCalendar.tsx
- Left panel: BentoCard with view toggle in `action` slot
- View toggles: `rounded-[1rem]` with emerald active state
- Calendar cells: `rounded-2xl`, selected day = `bg-emerald-600 shadow-xl shadow-emerald-200`
- Daily stats badges: `rounded-2xl bg-emerald-50/50 backdrop-blur`
- Right panel: Separate BentoCard for day detail
- Quick-add buttons: `rounded-[1.5rem]`, emerald primary

#### BarangayLeaderboard.tsx
- Wrapped in BentoCard with Trophy icon
- Sort dropdown moved to BentoCard `action` slot
- Progress bars: Emerald gradient shades (#10b981, #34d399, #6ee7b7, #a7f3d0)
- Rank badges: `rounded-xl` (was `rounded-full`)
- Highlighted row: `bg-emerald-50 ring-2 ring-emerald-400`

#### FarmerDistribution.tsx
- Analytics section: Collapsible BentoCard (`defaultExpanded={false}`)
- Inner chart panels: `rounded-2xl bg-white/50 backdrop-blur border border-white/30`
- Commodity pills: `rounded-[1.5rem] border-white/40 bg-white/50`

#### DataTable.tsx
- Wrapped in `<BentoCard noPadding>`
- Table headers: Glass style with `bg-slate-50/50`
- Active pagination: Emerald styling
- Search/filter inputs: `rounded-[1.5rem]` glass style

#### ManagementView.tsx
- Barangay list cards: `rounded-[2rem] bg-white/70 backdrop-blur-xl`
- Active barangay: `border-emerald-500 shadow-emerald-100/50`
- Detail panel: BentoCard wrapper

#### FarmerRegistry.tsx
- Farmer cards: `rounded-[2rem]` glassmorphic with hover shadows
- Icon hover wrappers on card icons
- Modal: `bg-white/92 backdrop-blur-xl rounded-[2rem]`
- Register button: Emerald with shadow

#### UserManagement.tsx
- Wrapped in `<BentoCard noPadding title="User Management" subtitle="System users & roles">`
- Table headers updated to match glass style

### Phase 4: Dialog & Button Components

#### RecordFormDialog.tsx
- Overlay: `bg-black/25 backdrop-blur-sm`
- Card: `rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 shadow-2xl`
- All inputs: `rounded-[1.5rem]` with emerald focus ring
- Buttons: Primary = `bg-emerald-600 rounded-[1.5rem] font-black shadow-lg shadow-emerald-200`
- Cancel: Glass pill = `bg-white/50 border-white/40 rounded-[1.5rem]`

#### FarmerFormDialog.tsx
- Same dialog glass treatment as RecordFormDialog
- Duplicate warning: Updated styling
- Success state: Emerald accent

#### FarmerSelectDialog.tsx
- Glass overlay + card (z-index 60 for stacking above RecordFormDialog)
- Checkboxes and search: Updated radius and focus styles
- Confirm button: Emerald

#### DeleteConfirmDialog.tsx
- Glass overlay + card
- Warning icon: Red background wrapper `rounded-2xl bg-red-100`
- Delete button: `bg-red-600 rounded-[1.5rem] font-black`
- Cancel: Glass pill

#### PasswordChangeDialog.tsx
- Glass overlay + card
- Key icon: Emerald background wrapper
- All inputs: `rounded-[1.5rem]` glass style with emerald focus
- Labels: `text-xs font-black uppercase tracking-widest text-slate-500`

#### ExportButton.tsx
- Trigger button: Glass pill `bg-white/50 backdrop-blur border-white/40 rounded-[1.5rem]`
- Dropdown: `rounded-[2rem] bg-white/90 backdrop-blur-xl border-white/40 shadow-2xl`
- Menu items: `hover:bg-emerald-50` (was hover:bg-blue-50)
- Month selector: Glass input with emerald focus

#### SeedButton.tsx
- Button: `border-emerald-200 bg-emerald-50 text-emerald-600` (was blue)
- Success state: `bg-emerald-100 text-emerald-700`
- Done state: `bg-slate-100 text-gray-500`

---

## 6. CSS Foundation Changes (`app/globals.css`)

### New CSS Custom Properties
```
--bg: #F0F4F8
--surface: rgba(255,255,255,0.70)
--surface-solid: #ffffff
--border: rgba(255,255,255,0.40)
--border-subtle: rgba(255,255,255,0.20)
--accent-green: #10b981
--accent-emerald: #059669
--shadow-hover: 0 25px 50px -12px rgba(16,185,129,0.15)
--radius-card: 2.5rem
--radius-button: 1.5rem
```

### New Utility Classes
| Class | Purpose |
|-------|---------|
| `.ui-card` | Glass card with hover shadow transition |
| `.ui-label` | Micro uppercase label (`text-[10px] font-black uppercase tracking-widest`) |
| `.ui-icon-wrap` | Icon wrapper with emerald group-hover |
| `.ui-dialog-overlay` | `bg-black/25 backdrop-blur-sm` fullscreen overlay |
| `.ui-dialog-card` | `bg-white/92 backdrop-blur-xl rounded-[2rem]` dialog card |

---

## 7. Chart Styling

All Recharts components updated for glass background contrast:

| Property | Value |
|----------|-------|
| CartesianGrid stroke | `#e2e8f0` (slate-200) |
| CartesianGrid style | `strokeDasharray="3 3"`, vertical or horizontal disabled |
| Axis tick | `fontSize: 10, fill: "#94a3b8"` (slate-400) |
| Axis lines | Hidden (`tickLine={false} axisLine={false}`) |
| Tooltip container | Glass: `borderRadius: 1.5rem, bg: rgba(255,255,255,0.95), backdropFilter: blur(20px)` |
| Bar radius | `[8, 8, 0, 0]` (top corners rounded) or `[6, 6, 0, 0]` |

---

## 8. What Was NOT Changed

| Layer | Files | Status |
|-------|-------|--------|
| Data context | `lib/agri-context.tsx` | Untouched |
| Auth context | `lib/auth-context.tsx` | Untouched |
| Auth credentials | `lib/auth.ts` | Untouched |
| Supabase client | `lib/supabase.ts` | Untouched |
| Types & constants | `lib/data.ts` | Untouched |
| Word export | `lib/export-docx.ts` | Untouched |
| Print report | `lib/print-report.ts` | Untouched |
| Seed data | `lib/seed-data.ts` | Untouched |
| Provider wrappers | `components/providers.tsx` | Untouched |
| Utility functions | `lib/utils.ts` | Untouched |

All CRUD operations, role-based access control, barangay filtering, export/print functionality, and real-time data sync remain identical.

---

## 9. File Summary

| # | File | Type | Change Level |
|---|------|------|-------------|
| 1 | `app/globals.css` | Modified | Foundation — CSS variables & utility classes |
| 2 | `components/ui/BentoCard.tsx` | **New** | Shared card component |
| 3 | `app/page.tsx` | Modified | Major — Sidebar + header restructure |
| 4 | `components/LoginPage.tsx` | Modified | Medium — Glass card, emerald accent |
| 5 | `components/dashboard/KpiCards.tsx` | Modified | Medium — Icon wrappers, glass cards |
| 6 | `components/dashboard/FindingMatrix.tsx` | Modified | Medium — BentoCard wrap, table restyle |
| 7 | `components/dashboard/CommodityAnalytics.tsx` | Modified | Low — BentoCard wrap |
| 8 | `components/dashboard/SubCategoryAnalytics.tsx` | Modified | Low — BentoCard wrap, filter pills |
| 9 | `components/dashboard/DamageRiskMonitoring.tsx` | Modified | Medium — 3 BentoCards + banner |
| 10 | `components/dashboard/DailySummaryCalendar.tsx` | Modified | High — Calendar cells, panels, toggles |
| 11 | `components/dashboard/BarangayLeaderboard.tsx` | Modified | Low — BentoCard wrap, progress bars |
| 12 | `components/dashboard/FarmerDistribution.tsx` | Modified | Low — Collapsible BentoCard |
| 13 | `components/dashboard/DataTable.tsx` | Modified | Medium — BentoCard noPadding, table |
| 14 | `components/dashboard/ManagementView.tsx` | Modified | Medium — Barangay list + detail cards |
| 15 | `components/dashboard/FarmerRegistry.tsx` | Modified | Medium — Grid cards, modal |
| 16 | `components/dashboard/UserManagement.tsx` | Modified | Low — BentoCard wrap |
| 17 | `components/dashboard/RecordFormDialog.tsx` | Modified | Low — Glass dialog |
| 18 | `components/dashboard/FarmerFormDialog.tsx` | Modified | Low — Glass dialog |
| 19 | `components/dashboard/FarmerSelectDialog.tsx` | Modified | Low — Glass dialog |
| 20 | `components/dashboard/DeleteConfirmDialog.tsx` | Modified | Low — Glass dialog |
| 21 | `components/dashboard/PasswordChangeDialog.tsx` | Modified | Low — Glass dialog |
| 22 | `components/dashboard/ExportButton.tsx` | Modified | Low — Glass dropdown |
| 23 | `components/dashboard/SeedButton.tsx` | Modified | Low — Emerald accent |

---

## 10. Build & Compatibility

- **Build status:** Clean pass (`npx next build` — no errors)
- **TypeScript:** No type errors
- **Framework:** Next.js 16.2.1 (Turbopack), React 19.2.4
- **CSS:** Tailwind CSS v4 with PostCSS
- **Browser support:** All modern browsers supporting `backdrop-filter`
- **Responsive:** Mobile, tablet, and desktop breakpoints maintained
- **Role-based views:** SUPER_ADMIN, ADMIN, BARANGAY_USER all render correctly
