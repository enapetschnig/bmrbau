-- ============================================================
-- BMR Bau: BUAK-Wochentyp-Kalender + getrennte Lang/Kurz-Zeitpläne
-- ============================================================
-- Modelliert das 14-Tage-Wechselschema der Bauwirtschaft (lange Woche
-- mit Fr, kurze ohne Fr). Quelle:
--  - buak_week_calendar: pro KW Wochentyp + optional Notiz (z. B. Feiertag)
--  - employees.regelarbeitszeit       → Zeitplan fuer "lange" Wochen (Mo-Fr)
--  - employees.regelarbeitszeit_kurz  → Zeitplan fuer "kurze" Wochen (Mo-Do)
--  - time_entries.week_type wird beim Speichern gesetzt, damit historische
--    Eintraege nachvollziehbar bleiben falls der Kalender spaeter geaendert
--    wird.
-- ============================================================

-- 1. Enum und Tabelle fuer den Wochentyp-Kalender
DO $$ BEGIN
  CREATE TYPE buak_week_type AS ENUM ('lang', 'kurz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.buak_week_calendar (
  year        SMALLINT NOT NULL,
  kw          SMALLINT NOT NULL CHECK (kw BETWEEN 1 AND 53),
  week_type   buak_week_type NOT NULL,
  notiz       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (year, kw)
);

ALTER TABLE public.buak_week_calendar ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten User duerfen lesen (brauchen sie fuer TimeTracking)
CREATE POLICY "buak_calendar_select" ON public.buak_week_calendar
  FOR SELECT USING (auth.role() = 'authenticated');

-- Nur Admin darf pflegen
CREATE POLICY "buak_calendar_admin_write" ON public.buak_week_calendar
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator'::app_role)
  );

-- 2. Zweiter Wochenplan fuer die kurze Woche
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS regelarbeitszeit_kurz JSONB;

COMMENT ON COLUMN public.employees.regelarbeitszeit    IS 'Zeitplan fuer lange Wochen (BUAK: Mo-Fr)';
COMMENT ON COLUMN public.employees.regelarbeitszeit_kurz IS 'Zeitplan fuer kurze Wochen (BUAK: Mo-Do, Fr frei)';

-- 3. Seeds: BMR-BUAK-Default-Schedules fuer bestehende Mitarbeiter
-- Mo-Do 07:00-16:45, 60 min Pause (12:00-13:00) = 8,75 h
-- Fr (lange Woche) 07:00-15:45, 60 min Pause = 7,75 h
-- Wochensoll lange Woche: 42,75 h (Rest ueber KV-39h als Zeitausgleich/Ueberstunde)
-- Wochensoll kurze Woche: 35,00 h
DO $$
DECLARE
  v_lang JSONB := '{
    "mo": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "di": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "mi": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "do": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "fr": { "start": "07:00", "end": "15:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 7.75 },
    "sa": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "so": { "start": null, "end": null, "pause": 0, "hours": 0 }
  }'::jsonb;

  v_kurz JSONB := '{
    "mo": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "di": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "mi": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "do": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "fr": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "sa": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "so": { "start": null, "end": null, "pause": 0, "hours": 0 }
  }'::jsonb;
BEGIN
  -- Nur fuer interne Mitarbeiter (nicht Extern) und wo noch nicht individualisiert
  UPDATE public.employees
     SET regelarbeitszeit = v_lang
   WHERE COALESCE(is_external, false) = false
     AND COALESCE(kategorie, '') <> 'extern'
     AND (regelarbeitszeit IS NULL OR regelarbeitszeit = '{}'::jsonb);

  UPDATE public.employees
     SET regelarbeitszeit_kurz = v_kurz
   WHERE COALESCE(is_external, false) = false
     AND COALESCE(kategorie, '') <> 'extern'
     AND regelarbeitszeit_kurz IS NULL;
END $$;

-- 4. Seed BUAK-Kalender 2026 + 2027: gerade KW = lang, ungerade KW = kurz
--    Admin kann die Zuordnung spaeter jederzeit ueberschreiben.
DO $$
DECLARE
  y SMALLINT;
  k SMALLINT;
  max_kw SMALLINT;
BEGIN
  FOREACH y IN ARRAY ARRAY[2026::SMALLINT, 2027::SMALLINT] LOOP
    -- Anzahl Kalenderwochen des Jahres (52 oder 53) robust via dec-28-Regel ermitteln
    SELECT EXTRACT(WEEK FROM make_date(y::int, 12, 28))::SMALLINT INTO max_kw;
    FOR k IN 1..max_kw LOOP
      INSERT INTO public.buak_week_calendar (year, kw, week_type)
      VALUES (y, k, CASE WHEN k % 2 = 0 THEN 'lang'::buak_week_type ELSE 'kurz'::buak_week_type END)
      ON CONFLICT (year, kw) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 5. Helper-Funktion: Wochentyp fuer ein Datum (nutzt ISO-KW)
CREATE OR REPLACE FUNCTION public.buak_week_type_for_date(p_datum DATE)
RETURNS buak_week_type
LANGUAGE SQL
STABLE
AS $$
  SELECT week_type
    FROM public.buak_week_calendar
   WHERE year = EXTRACT(ISOYEAR FROM p_datum)::SMALLINT
     AND kw   = EXTRACT(WEEK    FROM p_datum)::SMALLINT
  UNION ALL
  -- Fallback-Regel falls fuer das Jahr noch nichts gepflegt ist
  SELECT CASE WHEN EXTRACT(WEEK FROM p_datum)::INT % 2 = 0 THEN 'lang'::buak_week_type ELSE 'kurz'::buak_week_type END
  LIMIT 1;
$$;

-- 6. time_entries.week_type soll beim Speichern gefuellt werden – ein Trigger
--    garantiert das auch bei Admin-Direct-Updates via API.
CREATE OR REPLACE FUNCTION public.fill_time_entry_week_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.week_type IS NULL AND NEW.datum IS NOT NULL THEN
    NEW.week_type := public.buak_week_type_for_date(NEW.datum)::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_time_entry_week_type ON public.time_entries;
CREATE TRIGGER trg_fill_time_entry_week_type
  BEFORE INSERT OR UPDATE OF datum ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_time_entry_week_type();

-- 7. Bestehende time_entries nachziehen (einmaliges Backfill)
UPDATE public.time_entries
   SET week_type = public.buak_week_type_for_date(datum)::text
 WHERE week_type IS NULL;
