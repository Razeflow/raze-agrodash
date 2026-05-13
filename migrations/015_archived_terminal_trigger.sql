-- Phase 2 follow-up: enforce the "archived is terminal" rule.
--
-- A CHECK constraint can only inspect the new row's values, not the previous
-- ones, so it cannot block a transition. We use a BEFORE UPDATE OF status
-- trigger that rejects writes when the row is moving out of `archived`.
-- Self-edits (archived → archived) and writes to non-status fields are not
-- affected; if you want a stricter "archived rows are fully read-only" rule,
-- broaden the trigger to BEFORE UPDATE (without OF status) and compare more
-- columns.
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.agri_records_archived_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'archived' AND NEW.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION
      'Cannot transition record % out of archived status (attempted: %).',
      OLD.id, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agri_records_archived_terminal_trg ON public.agri_records;

CREATE TRIGGER agri_records_archived_terminal_trg
  BEFORE UPDATE OF status ON public.agri_records
  FOR EACH ROW
  EXECUTE FUNCTION public.agri_records_archived_terminal();
