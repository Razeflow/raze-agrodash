-- Migration 007: Add reporting period to agri_records.
-- The dashboard's records form has always collected period_month/period_year,
-- but they were dropped on insert because the columns didn't exist. This adds them
-- and backfills existing rows from created_at (Asia/Manila) so the UI's period
-- filter and Records-tab "Period" column work.

ALTER TABLE public.agri_records
  ADD COLUMN IF NOT EXISTS period_month SMALLINT,
  ADD COLUMN IF NOT EXISTS period_year  SMALLINT;

-- Backfill any rows that don't have a period yet.
UPDATE public.agri_records
SET
  period_month = EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Asia/Manila'))::smallint,
  period_year  = EXTRACT(YEAR  FROM (created_at AT TIME ZONE 'Asia/Manila'))::smallint
WHERE period_month IS NULL OR period_year IS NULL;

CREATE INDEX IF NOT EXISTS idx_agri_records_period
  ON public.agri_records(period_year, period_month);
