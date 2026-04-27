-- Head-of-household flag for farmers (app enforces at most one head per household).
-- Run after migrations/001_households_orgs.sql.

ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS is_household_head BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.farmers.is_household_head IS 'True if this farmer is the designated head of their household_id group.';
