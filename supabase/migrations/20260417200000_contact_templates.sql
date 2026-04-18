-- Kontakt-Vorlagen: wiederverwendbarer Pool (z.B. Zimmerer-Firmen)
CREATE TABLE IF NOT EXISTS contact_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  firma TEXT,
  rolle TEXT,
  telefon TEXT,
  email TEXT,
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_templates_name ON contact_templates(name);
CREATE INDEX IF NOT EXISTS idx_contact_templates_rolle ON contact_templates(rolle);

ALTER TABLE contact_templates ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten User koennen lesen
DROP POLICY IF EXISTS "Anyone can read contact templates" ON contact_templates;
CREATE POLICY "Anyone can read contact templates" ON contact_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins koennen einfuegen/aendern/loeschen
DROP POLICY IF EXISTS "Admins manage contact templates" ON contact_templates;
CREATE POLICY "Admins manage contact templates" ON contact_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'administrator'
    )
  );
