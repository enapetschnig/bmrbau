-- ============================================================
-- Lieferscheine: "Kunde verrechnet" Status
-- ============================================================

-- Status ob Lieferschein dem Kunden verrechnet wurde
ALTER TABLE warehouse_delivery_notes ADD COLUMN IF NOT EXISTS kunde_verrechnet BOOLEAN DEFAULT false;
