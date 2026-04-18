-- RLS: Mitarbeiter sehen nur Lieferscheine, keine Rechnungen
-- Nur Admin sieht Dokumente mit typ='rechnung'

DROP POLICY IF EXISTS "incoming_documents_select" ON incoming_documents;
CREATE POLICY "incoming_documents_select" ON incoming_documents
  FOR SELECT USING (
    -- Admin sieht alles
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'administrator'
    )
    -- Andere User sehen nur Lieferscheine + Lagerlieferscheine (keine Rechnungen)
    OR typ IN ('lieferschein', 'lagerlieferschein')
  );
