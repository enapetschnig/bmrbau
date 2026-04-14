-- ============================================================
-- Dokumentenbibliothek: Dynamische Kategorien + Links
-- Lohnzettel: Freigabetermin
-- ============================================================

-- 1: Dokumentenbibliothek - dynamische Kategorien
CREATE TABLE IF NOT EXISTS document_library_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Standard-Kategorien einfuegen
INSERT INTO document_library_categories (key, label, sort_order) VALUES
  ('baugesetz', 'Baugesetz', 1),
  ('oib', 'OIB-Richtlinien', 2),
  ('stmk', 'Stmk. Baugesetz', 3),
  ('diverse', 'Diverse', 4)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE document_library_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read categories" ON document_library_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage categories" ON document_library_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
);

-- 2: Dokumentenbibliothek - Links speichern
CREATE TABLE IF NOT EXISTS document_library_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_library_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read links" ON document_library_links FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage links" ON document_library_links FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
);

-- 3: Lohnzettel-Freigabetermin
CREATE TABLE IF NOT EXISTS payslip_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  freigabe_tag INTEGER DEFAULT 10,
  upload_month INTEGER NOT NULL,
  upload_year INTEGER NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payslip_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own payslip settings" ON payslip_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage payslip settings" ON payslip_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
);
