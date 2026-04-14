-- ============================================================
-- Plantafel Overhaul: Multi-Projekt/Tag + Jahresgrobplanung
-- ============================================================

-- 1: Mehrere Projekte pro Tag pro Mitarbeiter ermoeglichen
-- Entferne den UNIQUE constraint (user_id, datum) damit ein MA
-- an einem Tag mehreren Projekten zugeordnet werden kann
ALTER TABLE worker_assignments
  DROP CONSTRAINT IF EXISTS worker_assignments_user_id_datum_key;

-- Neuer UNIQUE constraint: (user_id, datum, project_id)
-- verhindert doppelte Zuordnung desselben Projekts am selben Tag
ALTER TABLE worker_assignments
  ADD CONSTRAINT worker_assignments_user_project_datum_key
  UNIQUE (user_id, datum, project_id);

-- 2: Jahresgrobplanung - Planungsbloecke fuer grobe Jahresplanung
CREATE TABLE IF NOT EXISTS yearly_plan_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  start_week INTEGER NOT NULL CHECK (start_week >= 1 AND start_week <= 53),
  end_week INTEGER NOT NULL CHECK (end_week >= 1 AND end_week <= 53),
  year INTEGER NOT NULL,
  partie TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS fuer yearly_plan_blocks
ALTER TABLE yearly_plan_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view plan blocks"
  ON yearly_plan_blocks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage plan blocks"
  ON yearly_plan_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'administrator'
    )
  );

-- Vorarbeiter koennen auch Planungsbloecke erstellen/bearbeiten
CREATE POLICY "Vorarbeiter can manage plan blocks"
  ON yearly_plan_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.kategorie = 'vorarbeiter'
    )
  );

-- 3: Ressourcen-Vorschlaege erweitern (gespeichert in app_settings)
INSERT INTO app_settings (key, value) VALUES
  ('resource_suggestions', 'Deckenschalung (m²),Wandschalung,Ziegelsaege,Mannschaftscontainer,Kran 1 - 30m Ausladung,Kran 2 - 34m Ausladung,Transportbedarf,Aluschalung,Eisenschalung,Bagger,Dumper,Eisen,Kamin,Daemmung,Diverses')
ON CONFLICT (key) DO NOTHING;
