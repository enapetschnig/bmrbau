-- Multiple-Choice-Fragen fuer Sicherheitsunterweisungen
ALTER TABLE safety_evaluations
  ADD COLUMN IF NOT EXISTS fragen JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inhalt_text TEXT;

-- Antworten pro Mitarbeiter (separat von personal_answers)
ALTER TABLE safety_evaluation_signatures
  ADD COLUMN IF NOT EXISTS fragen_antworten JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inhalte_bestaetigt BOOLEAN DEFAULT FALSE;
