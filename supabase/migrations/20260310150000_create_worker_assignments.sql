-- Plantafel: Einsatzplanung / Worker Assignments
CREATE TABLE worker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  notizen TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, datum)
);

-- Indexes
CREATE INDEX idx_worker_assignments_user_datum ON worker_assignments(user_id, datum);
CREATE INDEX idx_worker_assignments_project ON worker_assignments(project_id);
CREATE INDEX idx_worker_assignments_datum ON worker_assignments(datum);

-- RLS
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_worker_assignments" ON worker_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Mitarbeiter: read own assignments
CREATE POLICY "user_read_own_assignments" ON worker_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE worker_assignments;
