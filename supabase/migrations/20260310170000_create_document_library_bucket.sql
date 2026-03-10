-- Dokumentenbibliothek Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-library', 'document-library', false)
ON CONFLICT DO NOTHING;

-- Alle authentifizierten User können lesen
CREATE POLICY "auth_read_doc_library" ON storage.objects
  FOR SELECT USING (bucket_id = 'document-library' AND auth.role() = 'authenticated');

-- Nur Admin kann hochladen
CREATE POLICY "admin_write_doc_library" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'document-library'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Nur Admin kann löschen
CREATE POLICY "admin_delete_doc_library" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'document-library'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );
