-- ============================================================
-- Stundenerfassung Phase 1: Schema-Erweiterungen
-- ============================================================

-- 1A: Schwellenwert + Sichtbarkeit auf employees
-- Schwellenwert = Tagesgrenze, ab der Stunden als Zeitausgleich gelten
-- Format: {"mo": 10, "di": 10, "mi": 9.5, "do": 9.5, "fr": 0, "sa": 0, "so": 0}
ALTER TABLE employees ADD COLUMN IF NOT EXISTS schwellenwert JSONB DEFAULT NULL;

-- Sichtbarkeitsrechte pro Mitarbeiter (Admin kann pro MA steuern)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sichtbarkeit JSONB
  DEFAULT '{"auswertung": true, "zusatzaufwendungen": false, "fahrtengeld": true}';

-- 1B: Lohnstunden / Zeitausgleich-Spalten auf time_entries
-- lohnstunden = Stunden bis zum Schwellenwert (fuer Lohnverrechnung)
-- zeitausgleich_stunden = Stunden ueber dem Schwellenwert (nicht ausbezahlt)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS lohnstunden NUMERIC DEFAULT NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS zeitausgleich_stunden NUMERIC DEFAULT NULL;

-- Zusatzinfos fuer erweiterte Abwesenheitsarten (BEG, PF, SO)
-- Beispiel: {"verwandtschaftsgrad": "Onkel"} oder {"grund": "Umzug"}
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS absence_detail JSONB DEFAULT NULL;

-- 1C: monthly_signoffs Tabelle fuer Monatsabschluss
CREATE TABLE IF NOT EXISTS monthly_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_data TEXT,
  invalidated_at TIMESTAMPTZ DEFAULT NULL,
  invalidated_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- RLS fuer monthly_signoffs
ALTER TABLE monthly_signoffs ENABLE ROW LEVEL SECURITY;

-- Mitarbeiter sehen eigene Signoffs
CREATE POLICY "Users can view own signoffs"
  ON monthly_signoffs FOR SELECT
  USING (auth.uid() = user_id);

-- Mitarbeiter koennen eigene Signoffs erstellen
CREATE POLICY "Users can insert own signoffs"
  ON monthly_signoffs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins koennen alle Signoffs sehen
CREATE POLICY "Admins can view all signoffs"
  ON monthly_signoffs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'administrator'
    )
  );

-- Admins koennen Signoffs invalidieren (update)
CREATE POLICY "Admins can update signoffs"
  ON monthly_signoffs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'administrator'
    )
  );

-- 1D: App Settings fuer Stundenerfassung
INSERT INTO app_settings (key, value) VALUES
  ('kilometergeld_rate', '0.42'),
  ('show_ueberstunden', 'true'),
  ('show_kilometergeld', 'true'),
  ('show_zusatzaufwendungen', 'false')
ON CONFLICT (key) DO NOTHING;

-- 1E: Bad Weather Erweiterungen
ALTER TABLE bad_weather_records ADD COLUMN IF NOT EXISTS projekt_adresse TEXT DEFAULT NULL;
ALTER TABLE bad_weather_records ADD COLUMN IF NOT EXISTS gearbeitet_waehrend_sw BOOLEAN DEFAULT false;
ALTER TABLE bad_weather_records ADD COLUMN IF NOT EXISTS arbeitsstunden_waehrend_sw NUMERIC DEFAULT 0;
