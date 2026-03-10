-- Projektkontakte
CREATE TABLE project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rolle TEXT,
  telefon TEXT,
  email TEXT,
  firma TEXT,
  phase TEXT DEFAULT 'bauphase' CHECK (phase IN ('planungsphase', 'bauphase', 'beide')),
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

-- Admin: Full CRUD
CREATE POLICY "admin_all_contacts" ON project_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- MA: Lesen für zugewiesene Projekte
CREATE POLICY "user_read_assigned_contacts" ON project_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM worker_assignments
      WHERE user_id = auth.uid() AND project_id = project_contacts.project_id
    )
  );

CREATE INDEX idx_project_contacts_project ON project_contacts(project_id);

ALTER PUBLICATION supabase_realtime ADD TABLE project_contacts;
