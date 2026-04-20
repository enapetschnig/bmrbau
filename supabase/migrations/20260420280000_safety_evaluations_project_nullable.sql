-- ============================================================
-- Safety Evaluations: project_id nullable
-- ============================================================
-- Jahres- und Geraeteunterweisungen haben keinen Projekt-Bezug.
-- Der Code uebergibt dort bewusst NULL, aber die Tabelle hat noch
-- NOT NULL aus der alten Baustellenunterweisung-Zeit stehen.
--
-- Fix: Constraint entfernen. Baustellenunterweisungen tragen weiter
-- eine project_id, das wird jetzt im Application-Code sichergestellt.
-- ============================================================

ALTER TABLE public.safety_evaluations
  ALTER COLUMN project_id DROP NOT NULL;
