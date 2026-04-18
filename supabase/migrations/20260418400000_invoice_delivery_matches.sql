-- Junction-Tabelle: 1 Rechnung <-> N Lieferscheine (flexible Zuordnung)
CREATE TABLE IF NOT EXISTS invoice_delivery_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnung_id UUID NOT NULL REFERENCES incoming_documents(id) ON DELETE CASCADE,
  lieferschein_id UUID NOT NULL REFERENCES incoming_documents(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rechnung_id, lieferschein_id)
);

CREATE INDEX IF NOT EXISTS idx_idm_rechnung ON invoice_delivery_matches(rechnung_id);
CREATE INDEX IF NOT EXISTS idx_idm_lieferschein ON invoice_delivery_matches(lieferschein_id);

ALTER TABLE invoice_delivery_matches ENABLE ROW LEVEL SECURITY;

-- Nur Admin darf Matches verwalten (da Rechnungen Admin-only sind)
DROP POLICY IF EXISTS "idm_select_admin" ON invoice_delivery_matches;
CREATE POLICY "idm_select_admin" ON invoice_delivery_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'administrator'
    )
  );

DROP POLICY IF EXISTS "idm_write_admin" ON invoice_delivery_matches;
CREATE POLICY "idm_write_admin" ON invoice_delivery_matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'administrator'
    )
  );
