# Backup & Recovery Runbook

> Pilot-grade. Realistic for a solo developer. Read this before a deployment, run the dry-run once, and revisit when scale grows.

## What gets backed up

| Source | What | Cadence | Retention |
|---|---|---|---|
| Supabase auto-backup (Pro tier) | Whole database, point-in-time | Daily, automatic | 7 days |
| Manual `pg_dump` snapshot | Whole `public` schema | Once daily (you run it) | 30 days locally + cloud sync |
| Export-to-CSV (per barangay) | User-readable rollback artifact | Before each phase rollout (Phase 1 → 2 → 3) | Indefinite |
| Soft-deleted rows | Already preserved in-table via `deleted_at` (migration 020) | n/a | 90 days then service-role cleanup |

The Supabase auto-backup is your fast path for "oops, restore yesterday." The `pg_dump` is your disaster path for "Supabase is unreachable / project deleted."

## 1. Verify Supabase backups exist

Supabase only auto-backs-up on Pro tier. **Free tier has no guarantee.** Before pilot:

1. Supabase Dashboard → **Settings** → **General** → confirm plan is Pro or higher
2. Supabase Dashboard → **Database** → **Backups** → see "Daily backups: enabled" with a timestamp from the last 24h
3. If on Free: upgrade, or accept the risk and rely entirely on manual `pg_dump`

## 2. Manual pg_dump schedule

Run once per day. The simplest setup is a cron on your dev machine (or any always-on box). GitHub Actions also works.

### Environment

Get your DB connection string from Supabase: **Settings → Database → Connection string** (the URI form with `postgres://` and your password). Store it in your shell rc as:

```bash
export AGRO_DB_URL="postgres://postgres.<ref>:<pw>@aws-...-pooler.supabase.com:5432/postgres"
```

Do not put this in `.env*` files committed to git.

### The command

```bash
# pg_dump from any machine with postgresql-client installed
mkdir -p ~/agrodash-backups
pg_dump "$AGRO_DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  | gzip > "$HOME/agrodash-backups/$(date -u +%Y-%m-%d).sql.gz"
```

`--no-owner` and `--no-acl` strip role grants so the dump restores cleanly into any Postgres instance.

### Crontab line (Linux/macOS)

```cron
# Daily at 04:00 local time
0 4 * * * /usr/local/bin/pg_dump "$AGRO_DB_URL" --no-owner --no-acl --schema=public | gzip > "$HOME/agrodash-backups/$(date -u +\%Y-\%m-\%d).sql.gz" 2>> "$HOME/agrodash-backups/backup.log"
```

(Make sure `$AGRO_DB_URL` is in the cron environment — typically via `BASH_ENV=/path/to/env-file` at the top of the crontab.)

### Cloud sync

The local `~/agrodash-backups/` folder is your single point of failure on disk. Sync it nightly to:

- **S3-compatible bucket**: `aws s3 sync ~/agrodash-backups/ s3://agrodash-backups/ --delete`
- **Cloud Drive folder**: just put `~/agrodash-backups` inside Google Drive / iCloud / OneDrive
- **GitHub Actions artifact**: if you don't want to manage a bucket, schedule a workflow that runs the `pg_dump` and uploads the gzipped file as an artifact

### Retention

Keep 30 days. Older files get deleted by a daily cleanup:

```bash
find ~/agrodash-backups/ -name "*.sql.gz" -mtime +30 -delete
```

## 3. Restore from pg_dump (the disaster path)

Use this when Supabase is unreachable, you accidentally dropped the schema, or you need to rewind further than the 7-day Pro auto-backup.

### Restore into a scratch local Postgres (dry-run)

**Run this every quarter** to prove the backup actually works. A backup you've never restored is a backup that doesn't exist.

```bash
# Start a throwaway local Postgres (Docker is easiest)
docker run --rm -d --name agrodash-restore \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=agrodash_restore \
  -p 5433:5432 postgres:16

# Wait a few seconds for Postgres to start, then restore
gunzip -c ~/agrodash-backups/2026-05-17.sql.gz \
  | psql "postgres://postgres:local@localhost:5433/agrodash_restore"

# Sanity check: count the core tables
psql "postgres://postgres:local@localhost:5433/agrodash_restore" \
  -c "SELECT 'farmers' AS t, count(*) FROM farmers
      UNION ALL SELECT 'agri_records', count(*) FROM agri_records
      UNION ALL SELECT 'households', count(*) FROM households;"

# Tear down
docker stop agrodash-restore
```

If the counts match expectations, the backup is healthy. Document the row counts you expect for your pilot scale so you can spot a silent partial dump.

### Restore into Supabase (the real recovery)

1. **Create a fresh Supabase project** (don't restore into the broken one — keep it as evidence).
2. Get the new project's connection string from **Settings → Database**.
3. Restore the dump:

   ```bash
   gunzip -c ~/agrodash-backups/<date>.sql.gz \
     | psql "$NEW_DB_URL"
   ```

4. Re-apply any migrations newer than the backup date (look in `migrations/` against the backup's `_migrations` table or your runbook log).
5. Update your `.env.local` to point at the new project's URL and anon key.
6. Smoke-test: sign in with your admin account, verify dashboard loads, verify a record edit works.

## 4. CSV export snapshots (the user-readable path)

Before each pilot phase rollout (Phase 1 → 2 → 3 — see Section 10 of the pilot plan):

1. Sign in as super-admin in the app
2. For each barangay: filter to that barangay → click **Export** → save as `<barangay>_<YYYY-MM-DD>.csv`
3. For activity logs: Activity tab → **Export CSV** → save as `activity_<YYYY-MM-DD>.csv`
4. Stash the resulting bundle in your `~/agrodash-backups/exports/<date>/` folder
5. Sync to cloud storage along with `pg_dump`

These exports are not a strict backup (RLS-scoped, no schema), but they're human-readable. If a migration goes catastrophically wrong, you can manually re-enter critical data from these files while you fix the schema.

## 5. Migration rollback

Every migration in `migrations/` has a paired rollback in `migrations/rollback/<NN>_rollback.sql` (020 onwards). For older migrations, write the rollback ad-hoc — usually a `DROP TABLE` or `ALTER TABLE … DROP COLUMN`.

To roll back a migration:

1. Apply the rollback SQL from SQL Editor (service-role)
2. Verify the schema matches the prior state (run the verification queries from the original migration's footer)
3. Revert any app-side code that depended on the migration's columns (usually a `git revert <commit>` on the feature branch)
4. Redeploy

**Never** roll back a migration in prod without a fresh `pg_dump` taken seconds before.

## 6. Operational recovery checklist

In order, when you discover data has gone wrong:

1. **Stop the bleeding**: Tell pilot users to stop entering data. Either via a message or by temporarily flipping the app into read-only mode (e.g., a feature flag — defer if you don't have one).
2. **Diagnose scope**: One record? One barangay? All data?
3. **Check `app_errors`**: SQL Editor → `SELECT * FROM app_errors WHERE created_at > now() - interval '1 hour' ORDER BY created_at DESC;` — was there a code-side error that correlates?
4. **Check `activity_logs`**: Same window. Was there a delete or status change that explains it?
5. **Decide the path**:
   - **One record / few rows** and they're soft-deletable: open `/admin/restore`, click Restore. Done.
   - **Recent (<1h) and broader**: use Supabase auto-backup → **Database → Backups → Restore**. Coordinate with users to avoid losing fresh writes.
   - **Older than 24h**: use the most recent `pg_dump`. See Section 3.
   - **Schema corruption**: roll back the migration (Section 5), then restore data.
6. **Document**: write a one-paragraph note in your incident log — what happened, what you did, what you'd do differently. Even one sentence is better than nothing.

## 7. What's intentionally not in this runbook

- **Automated alerting** — you'll find out backups failed when you check the next morning. Acceptable at pilot scale. Add alerting when you have >3 barangays in production.
- **Geo-redundant backups** — Supabase backups + cloud sync of `pg_dump` is sufficient. Multi-region is overkill for the pilot footprint.
- **Encrypted backups** — `pg_dump` output is plaintext SQL. If your cloud storage isn't already encrypted (S3/GDrive/iCloud are by default), `gpg --symmetric` the file before sync.
- **Coordinated multi-user restore** — assumes one admin operating during recovery. Don't try to recover while pilot users are writing.

---

*Test the dry-run restore now (Section 3). A backup you've never restored is a story, not a backup.*
