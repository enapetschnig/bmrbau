-- Phase D Schritt 1: Projekt-Erweiterungen
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS bauherr TEXT,
  ADD COLUMN IF NOT EXISTS bauherr_kontakt TEXT,
  ADD COLUMN IF NOT EXISTS bauleiter TEXT,
  ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS start_datum DATE,
  ADD COLUMN IF NOT EXISTS end_datum DATE;
