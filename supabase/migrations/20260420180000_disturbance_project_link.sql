-- ============================================================
-- Regiebericht (disturbances) an Projekt koppeln
-- ============================================================
-- Bisher wurden Kundendaten im Regiebericht manuell eingegeben.
-- Neu: jeder Regiebericht gehoert zu einem Projekt, die Kundendaten
-- werden beim Anlegen aus den Projekt-Stammdaten uebernommen.
-- Alt-Eintraege bleiben mit project_id = NULL bestehen (Feld ist nullable).
-- ============================================================

ALTER TABLE public.disturbances
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disturbances_project ON public.disturbances(project_id);

COMMENT ON COLUMN public.disturbances.project_id
  IS 'Projekt, zu dem dieser Regiebericht gehoert. Kundendaten werden beim Anlegen aus projects uebernommen.';
