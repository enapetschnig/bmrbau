-- Sicherheit-Modul-Restrukturierung

-- 1. Modul-Zuordnung auf bestehende safety_evaluations
ALTER TABLE safety_evaluations
  ADD COLUMN IF NOT EXISTS modul TEXT DEFAULT 'baustellenunterweisung',
  ADD COLUMN IF NOT EXISTS jahr INTEGER,
  ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pdf_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kategorien TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ist_vorlage BOOLEAN DEFAULT FALSE;

-- Bestehende Eintraege als "baustellenunterweisung" markieren
UPDATE safety_evaluations SET modul = 'baustellenunterweisung' WHERE modul IS NULL;

-- Index fuer Filter
CREATE INDEX IF NOT EXISTS idx_safety_evaluations_modul ON safety_evaluations(modul);
CREATE INDEX IF NOT EXISTS idx_safety_evaluations_jahr ON safety_evaluations(jahr);

-- 2. Schulungen-Tabelle (zentrale Mitarbeiterverwaltung, Wiederholungsintervalle)
CREATE TABLE IF NOT EXISTS schulungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  beschreibung TEXT,
  kategorie TEXT DEFAULT 'allgemein',
  wiederholung_monate INTEGER DEFAULT 12,
  ist_pflicht BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE schulungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schulungen_select" ON schulungen;
CREATE POLICY "schulungen_select" ON schulungen
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "schulungen_admin" ON schulungen;
CREATE POLICY "schulungen_admin" ON schulungen
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- Beispiel-Schulungen
INSERT INTO schulungen (name, kategorie, wiederholung_monate, ist_pflicht) VALUES
  ('Erste Hilfe', 'medizin', 24, TRUE),
  ('Brandschutz', 'sicherheit', 12, TRUE),
  ('PU-Schaum Verarbeitung', 'material', 36, FALSE),
  ('Absturzsicherung', 'sicherheit', 12, TRUE),
  ('Ladungssicherung', 'transport', 24, FALSE)
ON CONFLICT DO NOTHING;

-- 3. Zertifikate / Schulungsnachweise pro Mitarbeiter
CREATE TABLE IF NOT EXISTS schulung_zertifikate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schulung_id UUID REFERENCES schulungen(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zertifikat_url TEXT,
  gueltig_ab DATE NOT NULL DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_zertifikate_user ON schulung_zertifikate(user_id);
CREATE INDEX IF NOT EXISTS idx_zertifikate_schulung ON schulung_zertifikate(schulung_id);
CREATE INDEX IF NOT EXISTS idx_zertifikate_gueltig_bis ON schulung_zertifikate(gueltig_bis);

ALTER TABLE schulung_zertifikate ENABLE ROW LEVEL SECURITY;

-- MA sieht eigene Zertifikate, Admin sieht alles
DROP POLICY IF EXISTS "zertifikate_select" ON schulung_zertifikate;
CREATE POLICY "zertifikate_select" ON schulung_zertifikate
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

DROP POLICY IF EXISTS "zertifikate_admin" ON schulung_zertifikate;
CREATE POLICY "zertifikate_admin" ON schulung_zertifikate
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- 4. Storage-Bucket fuer Zertifikate + Safety-Videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-materials', 'safety-materials', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "safety_materials_read" ON storage.objects;
CREATE POLICY "safety_materials_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'safety-materials');

DROP POLICY IF EXISTS "safety_materials_write" ON storage.objects;
CREATE POLICY "safety_materials_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'safety-materials' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "safety_materials_delete" ON storage.objects;
CREATE POLICY "safety_materials_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'safety-materials'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );
