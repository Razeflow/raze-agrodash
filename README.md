## AgriDash (AgriData Dashboard)

Municipal agricultural monitoring dashboard for Tubo: farmers registry, production records, damage/risk analytics, and programs/subsidies tracking.

## Architecture (high level)

- **App shell**: single-page tabbed dashboard in `app/page.tsx` (Overview, Damage, Farmers, Records, Programs, etc.).\n+- **Data layer**: client-side provider `lib/agri-context.tsx` loads Supabase tables on login, then exposes **visible, role-scoped slices** (barangay users see only their scope).\n+- **Defaults**:\n+  - **Alphabetical sorting** is applied in the context for farmers/households/organizations and in key pickers (case-insensitive, trimmed).\n+  - **Programs page** (`components/dashboard/ProgramsView.tsx`) has per-page pagination for households and organizations.\n+  - **Org members**: member count is clickable and opens a modal roster (`components/dashboard/OrganizationMembersDialog.tsx`) with deep-link to the Farmers registry.\n+  - **Destructive actions**: confirmation dialogs are centralized via `components/ui/ConfirmDialog.tsx` (type-to-confirm for org/household deletes).\n+
## Getting Started

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
