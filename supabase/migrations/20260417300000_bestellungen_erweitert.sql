-- Bestellungen: Polier-Zuweisung + Produktgruppe
ALTER TABLE bestellungen ADD COLUMN IF NOT EXISTS zugewiesen_an UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bestellungen ADD COLUMN IF NOT EXISTS produktgruppe TEXT;
ALTER TABLE bestellungen ADD COLUMN IF NOT EXISTS dokument_url TEXT;

CREATE INDEX IF NOT EXISTS idx_bestellungen_zugewiesen_an ON bestellungen(zugewiesen_an);
CREATE INDEX IF NOT EXISTS idx_bestellungen_produktgruppe ON bestellungen(produktgruppe);
CREATE INDEX IF NOT EXISTS idx_bestellungen_status ON bestellungen(status);
