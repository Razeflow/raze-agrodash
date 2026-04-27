-- Restrict organization INSERT/UPDATE/DELETE to SUPER_ADMIN and ADMIN only.
-- Barangay users keep SELECT (unchanged). Run in Supabase SQL Editor after backup.

DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
