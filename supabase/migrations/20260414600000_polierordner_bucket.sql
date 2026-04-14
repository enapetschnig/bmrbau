-- ============================================================
-- Polierordner: Neuer Storage Bucket + Projekt-Download Vorbereitung
-- ============================================================

-- Storage Bucket fuer Polierordner
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-polier', 'project-polier', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Vorarbeiter und Admins koennen Polierordner lesen/schreiben
CREATE POLICY "polier_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'project-polier' AND auth.role() = 'authenticated');

CREATE POLICY "polier_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-polier' AND (
      EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
      OR EXISTS (SELECT 1 FROM employees WHERE employees.user_id = auth.uid() AND employees.kategorie = 'vorarbeiter')
    )
  );

CREATE POLICY "polier_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-polier' AND (
      EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
      OR EXISTS (SELECT 1 FROM employees WHERE employees.user_id = auth.uid() AND employees.kategorie = 'vorarbeiter')
    )
  );
