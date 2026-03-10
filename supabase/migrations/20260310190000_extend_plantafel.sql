-- Ressourcen pro Projekt-Tag auf der Plantafel
CREATE TABLE assignment_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  resource_name TEXT NOT NULL,
  menge NUMERIC(10,2),
  einheit TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, datum, resource_name)
);

-- Tagesziel + Nachkalkulation pro Projekt-Tag
CREATE TABLE project_daily_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  tagesziel TEXT,
  nachkalkulation_stunden NUMERIC(6,2),
  notizen TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, datum)
);

-- Indexes
CREATE INDEX idx_assignment_resources_project_datum ON assignment_resources(project_id, datum);
CREATE INDEX idx_project_daily_targets_project_datum ON project_daily_targets(project_id, datum);

-- RLS: Admin + Vorarbeiter (über user_roles)
ALTER TABLE assignment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_daily_targets ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all_assignment_resources" ON assignment_resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "admin_all_project_daily_targets" ON project_daily_targets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Alle authentifizierten Benutzer können lesen
CREATE POLICY "auth_read_assignment_resources" ON assignment_resources
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_project_daily_targets" ON project_daily_targets
  FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE assignment_resources;
ALTER PUBLICATION supabase_realtime ADD TABLE project_daily_targets;

-- Updated_at trigger für targets
CREATE TRIGGER set_project_daily_targets_updated_at
  BEFORE UPDATE ON project_daily_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
