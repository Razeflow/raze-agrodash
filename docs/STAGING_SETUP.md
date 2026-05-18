# Staging Environment Setup

> Pilot-grade environment separation. The goal isn't a multi-environment CI/CD pipeline — it's "I can break things in a place that isn't production."

## Why staging exists

Today (pre-pilot) you've been doing everything against a single Supabase project. Once real pilot users are on it, you need:

- A safe place to **apply new migrations** before prod
- A place to **rehearse the rollback runbook** without panic
- A place to **smoke-test schema changes** with seed data that mimics production

A second Supabase project is the cheapest unit of separation. Free tier works fine for a staging environment that nobody depends on.

## One-time setup

### 1. Create the staging Supabase project

1. Supabase Dashboard → **New project** → name it `agrodash-staging`
2. Pick the same region as prod
3. Note the URL + anon key + service-role key

### 2. Apply ALL migrations to staging

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), so applying them in order is safe.

```
migrations/001_households_orgs.sql
migrations/002_household_subsidies.sql
migrations/003_calamity_sub_category.sql
migrations/004_organizations_admin_only.sql
migrations/005_farmer_household_head.sql
migrations/006_auto_profile_trigger.sql
migrations/007_farmer_assets.sql
migrations/008_records_check_constraints.sql
migrations/009_farmer_assets_livestock.sql
migrations/010_records_lifecycle_status.sql
migrations/011_phase1_domain_model.sql
migrations/012_validate_phase1_constraints.sql
migrations/013_phase2_domain_enforcement.sql
migrations/014_validate_phase2_constraints.sql
migrations/015_archived_terminal_trigger.sql
migrations/016_agri_records_rls.sql
migrations/017_land_allocation.sql
migrations/018_farmer_assets_reset.sql    -- only if needed; reconciliation migration
migrations/019_activity_logs.sql
migrations/020_soft_delete.sql            -- Pilot Hardening Week 1
migrations/021_app_errors.sql             -- Pilot Hardening Week 1
```

Open each in SQL Editor → Run → confirm success via the verification query in the footer.

### 3. Seed staging data

Use the existing `seed:supabase` script with staging credentials:

```bash
# In a separate terminal (don't pollute your normal shell env)
SUPABASE_URL=https://agdpjlrjialjvlwjtkvr-staging.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<staging service role> \
npm run seed:supabase
```

(Check `scripts/seed-supabase-bulk.ts` for which env vars it reads — adjust if the script uses different names.)

Production-like seed data lets you find UI bugs that only appear with real-shaped data.

### 4. Create staging admin accounts

Same accounts as prod, same passwords (it's not prod data, security risk is low):

```sql
-- Run in staging SQL Editor as service role
-- (your seed script may already do this — check first)
INSERT INTO auth.users (...) VALUES (...);
INSERT INTO public.profiles (id, username, display_name, role, barangay) VALUES (...);
```

Easier: clone the prod profile table:

```sql
-- In prod: dump profiles
\copy public.profiles TO 'profiles.csv' CSV HEADER;

-- In staging:
\copy public.profiles FROM 'profiles.csv' CSV HEADER;
```

Then **manually reset passwords in staging** via Supabase Studio → Authentication → Users. Don't reuse prod credentials.

## Switching environments locally

### .env files

Create both files in the project root:

**.env.local** (your default — points at prod by default for the team)

```
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
```

**.env.staging** (you maintain this; not committed)

```
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
```

Both files are gitignored (`.gitignore` already excludes `.env*` except `.env.example`).

### The simplest switch: file swap

```bash
# Switch to staging
cp .env.local .env.local.bak && cp .env.staging .env.local
npm run dev

# Switch back to prod
cp .env.local.bak .env.local
npm run dev
```

Not glamorous, but it works without new dependencies.

### Smarter: a shell alias

```bash
# in your .bashrc / .zshrc
alias agro-staging='cd ~/path/to/agri-dashboard && cp .env.staging .env.local && npm run dev'
alias agro-prod='cd ~/path/to/agri-dashboard && cp .env.local.prod .env.local && npm run dev'
```

(Keep `.env.local.prod` as the canonical prod file, then `.env.local` is just whatever you last loaded.)

### Avoid the trap: visual indicator

When running against staging, make it **impossible to forget**. Options:

- Set a different favicon for staging (`public/icon.svg` swapped out)
- Add a `NEXT_PUBLIC_ENV_LABEL=STAGING` env var and render a small "STAGING" badge in the dashboard header if set
- Use different test-account passwords so you can't muscle-memory your way into prod

The Vercel preview deployment pattern is the gold standard here, but for now the visual cue is the cheap version.

## Promoting changes prod ↔ staging

### Schema changes

**Always** apply migrations to staging first:

1. Write the migration SQL in `migrations/0NN_*.sql`
2. Apply to staging → verify with footer queries → test the app against staging
3. Only then apply to prod
4. After prod is on the new schema, deploy the app code that depends on it

### Data flow

You do NOT want prod data in staging (PII risk + RLS confusion). The seed script + the cloned profile table is enough.

If you NEED a recent prod snapshot to debug a real issue, use `pg_dump` from prod and restore into a third "diagnostic" Supabase project — not your shared staging.

### What never goes from staging → prod

- Schema migrations: re-write the SQL, don't dump+restore
- Auth users: prod has real users, staging has fakes; never overwrite
- Seed data: stays in staging

## Verifying the separation

Once a week, prove staging ≠ prod by clicking around staging and confirming:

- Different barangays / different farmer counts than prod (because seed data differs)
- The staging URL in the address bar (or your env badge)
- A test record you created in staging does NOT appear in prod (and vice versa)

If you ever see prod data in staging or vice versa, **stop using both** until you figure out which env you're connected to.

## What's intentionally not in this guide

- **Vercel preview deployments** — Vercel auto-creates a preview per PR if you set `NEXT_PUBLIC_SUPABASE_URL` per-environment. Worth doing later, not required for pilot.
- **GitHub Actions for migration application** — manual SQL Editor is fine at pilot scale (you'll apply maybe 1 migration/week).
- **Service-role key in CI** — keep service-role keys local. If you eventually need them in CI for seed/migration jobs, use GitHub Actions secrets.

---

*Worked example: applying migration 022 (whenever we write it).*
*1. Open SQL Editor on the staging project. Paste 022_*.sql. Run.*
*2. Run the footer's verification query. Confirm the expected row count.*
*3. Switch your local app to staging (`.env.staging` → `.env.local`).*
*4. Click through the affected feature. Verify no regressions.*
*5. Open SQL Editor on prod. Paste the same SQL. Run.*
*6. Switch local app back to prod. Smoke-test once more.*
*7. Deploy the app code that depends on the new migration.*
