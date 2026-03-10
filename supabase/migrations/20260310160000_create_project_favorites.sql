-- Projekt-Favoriten (max 3 pro User, via App-Logik)
CREATE TABLE project_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, project_id)
);

ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_favorites" ON project_favorites
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_project_favorites_user ON project_favorites(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE project_favorites;
