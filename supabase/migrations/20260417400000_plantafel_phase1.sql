-- Plantafel Overhaul Phase 1: Stammdaten + Erweiterungen

-- 1. Ressourcen-Stammdatentabelle (Deckenschalung, Kran 1, Transport LKW etc.)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kategorie TEXT NOT NULL DEFAULT 'geraet',
  einheit TEXT DEFAULT 'Stk',
  flaeche_m2 NUMERIC(10,2),
  farbe TEXT DEFAULT '#94A3B8',
  notizen TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_kategorie ON resources(kategorie);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alle authentifizierten lesen Ressourcen" ON resources;
CREATE POLICY "Alle authentifizierten lesen Ressourcen" ON resources
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin+Vorarbeiter verwalten Ressourcen" ON resources;
CREATE POLICY "Admin+Vorarbeiter verwalten Ressourcen" ON resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
    OR EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND kategorie = 'vorarbeiter')
  );

-- 2. Jahres-Ressourcen-Blöcke (Gantt-Balken für Ressourcen in Jahresgrobplanung)
CREATE TABLE IF NOT EXISTS yearly_resource_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  color TEXT DEFAULT '#F97316',
  label TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_week_range CHECK (start_week >= 1 AND start_week <= 53 AND end_week >= start_week AND end_week <= 53)
);

CREATE INDEX IF NOT EXISTS idx_yrb_resource ON yearly_resource_blocks(resource_id);
CREATE INDEX IF NOT EXISTS idx_yrb_project ON yearly_resource_blocks(project_id);
CREATE INDEX IF NOT EXISTS idx_yrb_year ON yearly_resource_blocks(year);

ALTER TABLE yearly_resource_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alle authentifizierten lesen Resource Blocks" ON yearly_resource_blocks;
CREATE POLICY "Alle authentifizierten lesen Resource Blocks" ON yearly_resource_blocks
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin+Vorarbeiter verwalten Resource Blocks" ON yearly_resource_blocks;
CREATE POLICY "Admin+Vorarbeiter verwalten Resource Blocks" ON yearly_resource_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
    OR EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND kategorie = 'vorarbeiter')
  );

-- 3. Individueller Name zu yearly_plan_blocks hinzufuegen (zusaetzlich zu "partie")
ALTER TABLE yearly_plan_blocks ADD COLUMN IF NOT EXISTS individual_name TEXT;

-- 4. Transport-Flag pro Tag-Projekt-Zuweisung
ALTER TABLE worker_assignments ADD COLUMN IF NOT EXISTS transport_erforderlich BOOLEAN DEFAULT FALSE;

-- Tagesbezogenes Transport-Flag pro Projekt (unabhaengig von Mitarbeiter)
CREATE TABLE IF NOT EXISTS project_day_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  erforderlich BOOLEAN DEFAULT TRUE,
  notiz TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, datum)
);

ALTER TABLE project_day_transport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alle authentifizierten lesen Transport" ON project_day_transport;
CREATE POLICY "Alle authentifizierten lesen Transport" ON project_day_transport
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin+Vorarbeiter verwalten Transport" ON project_day_transport;
CREATE POLICY "Admin+Vorarbeiter verwalten Transport" ON project_day_transport
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
    OR EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND kategorie = 'vorarbeiter')
  );

-- 5. Feiertags-Typ zu company_holidays
ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS typ TEXT DEFAULT 'betriebsurlaub';
-- Werte: 'betriebsurlaub', 'feiertag'

-- 6. Rechte-Settings fuer Jahresgrobplanung in app_settings
INSERT INTO app_settings (key, value) VALUES
  ('jahresgrobplanung_rollen', '{"admin":true,"vorarbeiter":true,"facharbeiter":false,"lehrling":false,"extern":false}')
ON CONFLICT (key) DO NOTHING;

-- 7. Beispiel-Ressourcen seed (nur wenn Tabelle leer)
INSERT INTO resources (name, kategorie, einheit, farbe, sort_order)
SELECT * FROM (VALUES
  ('Deckenschalung', 'schalung', 'm²', '#F59E0B', 10),
  ('Wandschalung', 'schalung', 'm²', '#F97316', 20),
  ('Ziegelsäge', 'geraet', 'Stk', '#8B5CF6', 30),
  ('Mannschaftscontainer', 'container', 'Stk', '#06B6D4', 40),
  ('Kran 1 - 30m Ausladung', 'geraet', 'Stk', '#EF4444', 50),
  ('Kran 2 - 34m Ausladung', 'geraet', 'Stk', '#DC2626', 60),
  ('Transport LKW', 'transport', 'Stk', '#10B981', 70)
) AS v(name, kategorie, einheit, farbe, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM resources LIMIT 1);
