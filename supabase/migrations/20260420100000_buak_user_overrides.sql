-- ============================================================
-- BUAK-Kalender: User duerfen Wochentyp setzen + is_manual tracken
-- ============================================================
-- Der Wochentyp soll fuer jede ganze KW gelten (nicht pro Eintrag).
-- Mitarbeiter duerfen ihn korrigieren, die Korrektur wird sichtbar
-- markiert, damit Admin nachvollziehen kann dass jemand eingegriffen hat.
-- ============================================================

-- 1. is_manual-Spalte: wurde der Eintrag per Knopfdruck gesetzt
--    (true) oder stammt er aus dem Regel-Seed (false)?
ALTER TABLE public.buak_week_calendar
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

-- Historie: Seeds in Migration 20260418140000 wurden automatisch erzeugt
-- -> is_manual bleibt false. Ab jetzt setzen alle Mutationen es auf true.

-- 2. RLS-Policy oeffnen: jeder authentifizierte User darf Wochentyp setzen
--    (nicht nur Admin). Wird via is_manual transparent gemacht.
DROP POLICY IF EXISTS "buak_calendar_admin_write" ON public.buak_week_calendar;

CREATE POLICY "buak_calendar_auth_write" ON public.buak_week_calendar
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Trigger: updated_by, updated_at und is_manual automatisch pflegen
CREATE OR REPLACE FUNCTION public.buak_calendar_track_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  -- Jede manuelle Mutation (UPSERT vom Client) ist per Definition manual.
  -- Seeds kommen ueber INSERTs ohne Trigger-Pfad (Migration-Skript).
  NEW.is_manual := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buak_calendar_track_changes ON public.buak_week_calendar;
CREATE TRIGGER trg_buak_calendar_track_changes
  BEFORE INSERT OR UPDATE ON public.buak_week_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.buak_calendar_track_changes();

-- 4. buak_week_type_for_date: auch is_manual zurueckgeben (optional).
--    Die bestehende Funktion liefert nur den Typ; fuer den Hook reichen
--    die Felder aus der Tabellen-SELECT-Abfrage. Kein Change hier.
