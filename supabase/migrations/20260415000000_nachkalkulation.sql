-- ============================================================
-- Nachkalkulation fuer Polierordner
-- ============================================================

CREATE TABLE IF NOT EXISTS nachkalkulation_positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position_nr TEXT,
  beschreibung TEXT NOT NULL,
  geplante_stunden NUMERIC(8,2) DEFAULT 0,
  ist_stunden NUMERIC(8,2) DEFAULT 0,
  notizen TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nachkalkulation_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read nachkalkulation" ON nachkalkulation_positionen FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admin and Vorarbeiter can manage nachkalkulation" ON nachkalkulation_positionen FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
    OR EXISTS (SELECT 1 FROM employees WHERE employees.user_id = auth.uid() AND employees.kategorie = 'vorarbeiter')
  );
