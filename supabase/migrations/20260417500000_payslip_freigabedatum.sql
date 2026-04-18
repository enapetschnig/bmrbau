-- Lohnzettel-Freigabedatum: MA sieht Lohnzettel erst ab diesem Datum
CREATE TABLE IF NOT EXISTS payslip_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL UNIQUE,
  release_date DATE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payslip_metadata_user ON payslip_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_payslip_metadata_release ON payslip_metadata(release_date);

ALTER TABLE payslip_metadata ENABLE ROW LEVEL SECURITY;

-- User sieht nur eigene Lohnzettel-Metadaten (nach Freigabedatum gefiltert in Client)
DROP POLICY IF EXISTS "User lesen eigene Payslip-Metadaten" ON payslip_metadata;
CREATE POLICY "User lesen eigene Payslip-Metadaten" ON payslip_metadata
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Nur Admins koennen Metadaten einfuegen/aendern/loeschen
DROP POLICY IF EXISTS "Admin verwaltet Payslip-Metadaten" ON payslip_metadata;
CREATE POLICY "Admin verwaltet Payslip-Metadaten" ON payslip_metadata
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Default fuer zuletzt verwendetes Freigabedatum
INSERT INTO app_settings (key, value) VALUES
  ('last_payslip_release_date', '')
ON CONFLICT (key) DO NOTHING;
