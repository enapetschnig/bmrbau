-- ============================================================
-- BUAK-Kalender: Nur Admin darf einstellen + Reset auf Regel-Werte
-- ============================================================
-- Die vorherige Migration 20260420100000_buak_user_overrides hatte die
-- Policy geoeffnet, sodass jeder authentifizierte User den Wochentyp
-- fuer eine KW setzen konnte (inkl. vom TimeTracking-Toggle aus).
-- Dadurch sind Kalender-Eintraege entstanden, die nicht mehr dem BMR-
-- Default entsprechen. Jetzt wieder eingrenzen auf Admin-only und alle
-- 2026/2027-Eintraege zurueck auf die BUAK-Regel "gerade KW = lang".
-- ============================================================

-- 1. Trigger-Funktion anpassen: is_manual + updated_by nur setzen, wenn
--    ein User-Kontext besteht. Bei Migrations/Seed-Inserts (auth.uid() IS NULL)
--    bleiben die Werte bei dem, was im INSERT/UPDATE-Payload steht.
CREATE OR REPLACE FUNCTION public.buak_calendar_track_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
    NEW.is_manual := true;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. RLS-Policy: Schreiben nur fuer Administratoren
DROP POLICY IF EXISTS "buak_calendar_auth_write" ON public.buak_week_calendar;

CREATE POLICY "buak_calendar_admin_write" ON public.buak_week_calendar
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'administrator'::app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'administrator'::app_role)
  );

-- 3. Reset: 2026 + 2027 auf Regel-Default zurueck, is_manual=false
--    Alte Eintraege loeschen und neu einfuegen. Da der Trigger jetzt
--    auth.uid() prueft, wird is_manual nicht mehr ueberschrieben.
DELETE FROM public.buak_week_calendar WHERE year IN (2026, 2027);

DO $$
DECLARE
  y SMALLINT;
  k SMALLINT;
  max_kw SMALLINT;
BEGIN
  FOREACH y IN ARRAY ARRAY[2026::SMALLINT, 2027::SMALLINT] LOOP
    SELECT EXTRACT(WEEK FROM make_date(y::int, 12, 28))::SMALLINT INTO max_kw;
    FOR k IN 1..max_kw LOOP
      INSERT INTO public.buak_week_calendar (year, kw, week_type, notiz, is_manual)
      VALUES (
        y,
        k,
        CASE WHEN k % 2 = 0 THEN 'lang'::buak_week_type ELSE 'kurz'::buak_week_type END,
        NULL,
        false
      );
    END LOOP;
  END LOOP;
END $$;
