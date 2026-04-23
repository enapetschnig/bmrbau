-- ============================================================
-- Admin + Vorarbeiter duerfen time_entries fuer andere Mitarbeiter
-- anlegen/aendern/loeschen. Normale Mitarbeiter weiterhin nur eigene.
-- ============================================================

-- Helper: ist der aktuelle Nutzer Vorarbeiter oder Admin?
-- "Vorarbeiter" steckt in employees.kategorie (kein eigenes user_roles-
-- Enum), "Administrator" in user_roles.role.
CREATE OR REPLACE FUNCTION public.can_manage_foreign_time_entries(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'administrator'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.employees
      WHERE user_id = _user_id
        AND kategorie = 'vorarbeiter'
    );
$$;

-- Bestehende Insert/Update/Delete-Policies weiten.
DROP POLICY IF EXISTS "Users can insert own time entries" ON public.time_entries;
CREATE POLICY "Insert time entries (own or as admin/vorarbeiter)"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR public.can_manage_foreign_time_entries(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own time entries" ON public.time_entries;
CREATE POLICY "Update time entries (own or as admin/vorarbeiter)"
  ON public.time_entries FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.can_manage_foreign_time_entries(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own time entries" ON public.time_entries;
CREATE POLICY "Delete time entries (own or as admin/vorarbeiter)"
  ON public.time_entries FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.can_manage_foreign_time_entries(auth.uid())
  );

-- SELECT-Policy fuer Vorarbeiter: duerfen alle Eintraege sehen (sonst
-- kann er die fremden Eintraege nicht bearbeiten). Admin hat schon
-- eine "view all"-Policy, die bleibt.
CREATE POLICY "Vorarbeiter can view all time entries"
  ON public.time_entries FOR SELECT
  USING (public.can_manage_foreign_time_entries(auth.uid()));
