-- Diverses-Zeilen pro Mitarbeiter/Monat (Zulagen, Pauschalen etc.)
CREATE TABLE report_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  monat INT NOT NULL CHECK (monat BETWEEN 1 AND 12),
  jahr INT NOT NULL CHECK (jahr BETWEEN 2020 AND 2100),
  bezeichnung TEXT NOT NULL,
  betrag NUMERIC(10,2),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, jahr, monat, bezeichnung)
);

ALTER TABLE report_extras ENABLE ROW LEVEL SECURITY;

-- Admin: Full CRUD
CREATE POLICY "admin_all_report_extras" ON report_extras
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- MA kann eigene lesen
CREATE POLICY "user_read_own_extras" ON report_extras
  FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_report_extras_user_month ON report_extras(user_id, jahr, monat);

ALTER PUBLICATION supabase_realtime ADD TABLE report_extras;
