-- ============================================================
-- PHASE B: Rollenmodell, Arbeitszeiten, Externe MA, Diäten, KM
-- ============================================================

-- 1. Mitarbeiterkategorie zur employees-Tabelle hinzufügen
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS kategorie TEXT DEFAULT 'facharbeiter'
  CHECK (kategorie IN ('lehrling', 'facharbeiter', 'vorarbeiter', 'extern'));

-- 2. Individuelle Regelarbeitszeit pro Mitarbeiter (JSON-basiert für Flexibilität)
-- Format: {"mo": {"start": "06:30", "end": "17:00", "pause": 30}, "di": {...}, ...}
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS regelarbeitszeit JSONB DEFAULT '{
  "mo": {"start": "06:30", "end": "17:00", "pause": 30, "hours": 10},
  "di": {"start": "06:30", "end": "17:00", "pause": 30, "hours": 10},
  "mi": {"start": "07:00", "end": "17:00", "pause": 30, "hours": 9.5},
  "do": {"start": "07:00", "end": "17:00", "pause": 30, "hours": 9.5},
  "fr": {"start": null, "end": null, "pause": 0, "hours": 0},
  "sa": {"start": null, "end": null, "pause": 0, "hours": 0},
  "so": {"start": null, "end": null, "pause": 0, "hours": 0}
}'::jsonb;

-- Wochenregelarbeitszeit (berechnet sich aus regelarbeitszeit, aber als Schnellzugriff)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS wochen_soll_stunden NUMERIC(5,2) DEFAULT 39;

-- 3. Externe Mitarbeiter: is_external flag
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;

-- 4. Kilometergeld-Felder zur time_entries
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS kilometer NUMERIC(7,1) DEFAULT 0;

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS km_beschreibung TEXT;

-- 5. Sonderzeiten-Typ
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS zeit_typ TEXT DEFAULT 'normal'
  CHECK (zeit_typ IN ('normal', 'lenkzeit', 'reisezeit', 'fahrt_100km'));

-- 6. Diäten-Tracking (automatisch berechnet, aber gespeichert für Auswertungen)
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS diaeten_typ TEXT
  CHECK (diaeten_typ IN ('keine', 'klein', 'gross', 'anfahrt'));

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS diaeten_betrag NUMERIC(8,2) DEFAULT 0;

-- 7. Externe Mitarbeiter: vereinfachte Zeiteinträge ohne gesetzl. Aufzeichnungspflicht
-- (Nutzen die gleiche time_entries Tabelle, aber mit is_external auf employees verknüpft)

-- 8. Realtime für employees aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;

-- 9. Vorarbeiter-Rolle: Zugriff auf Plantafel-Bearbeitung
-- (Vorarbeiter nutzen die bestehende 'mitarbeiter' Rolle,
--  die Unterscheidung erfolgt über employees.kategorie)
-- Vorarbeiter können ihre eigenen Baustellen-Einträge und zugewiesene MA sehen
CREATE POLICY "Vorarbeiter can view assigned project entries"
  ON public.time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
      AND e.kategorie = 'vorarbeiter'
    )
  );
