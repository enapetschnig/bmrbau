-- Incoming documents: Lieferscheine, Lagerlieferscheine, Rechnungen von Lieferanten
CREATE TABLE IF NOT EXISTS incoming_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  typ TEXT NOT NULL CHECK (typ IN ('lieferschein', 'lagerlieferschein', 'rechnung')),
  status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
  photo_url TEXT NOT NULL,
  -- KI-extrahierte Felder
  lieferant TEXT,
  dokument_datum DATE,
  dokument_nummer TEXT,
  betrag NUMERIC(12,2),
  positionen JSONB DEFAULT '[]',
  -- Mitarbeiter-Unterschrift
  unterschrift TEXT,
  unterschrift_name TEXT,
  -- Metadaten
  notizen TEXT,
  bezahlt_am DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE incoming_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incoming_documents_select" ON incoming_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "incoming_documents_insert" ON incoming_documents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "incoming_documents_update" ON incoming_documents
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator'
    )
  );

CREATE POLICY "incoming_documents_delete" ON incoming_documents
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator'
    )
  );

-- Indexes
CREATE INDEX idx_incoming_documents_project ON incoming_documents(project_id);
CREATE INDEX idx_incoming_documents_typ ON incoming_documents(typ);
CREATE INDEX idx_incoming_documents_status ON incoming_documents(status);
CREATE INDEX idx_incoming_documents_datum ON incoming_documents(dokument_datum);
CREATE INDEX idx_incoming_documents_lieferant ON incoming_documents(lieferant);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('incoming-documents', 'incoming-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "incoming_docs_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'incoming-documents');

CREATE POLICY "incoming_docs_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'incoming-documents');

CREATE POLICY "incoming_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'incoming-documents');
