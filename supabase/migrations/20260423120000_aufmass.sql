-- ============================================================
-- Aufmaßblätter (Bau-Aufmaß / Leistungsmengen-Erfassung)
-- ============================================================
-- Pro Projekt koennen mehrere Aufmaßblaetter angelegt werden,
-- jedes mit einer Liste von Positionen (Pos.-Nr., Bezeichnung,
-- Berechnung, Menge, Einheit). Eingabe entweder per Tastatur
-- ODER pro Zeile per Stift (Bild als Base64 PNG).

CREATE TABLE IF NOT EXISTS public.aufmass_sheets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titel       TEXT,
  aufmass_nr  TEXT,
  datum       DATE NOT NULL DEFAULT CURRENT_DATE,
  bauleiter   TEXT,
  gewerk      TEXT,
  notizen     TEXT,
  status      TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'abgeschlossen')),
  pdf_url     TEXT,
  pdf_generated_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aufmass_sheets_project
  ON public.aufmass_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_aufmass_sheets_user
  ON public.aufmass_sheets(user_id);

CREATE TABLE IF NOT EXISTS public.aufmass_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id        UUID NOT NULL REFERENCES public.aufmass_sheets(id) ON DELETE CASCADE,
  sort_order      INT NOT NULL DEFAULT 0,
  input_mode      TEXT NOT NULL DEFAULT 'text'
    CHECK (input_mode IN ('text', 'sketch')),
  -- Text-Modus
  pos_nr          TEXT,
  bezeichnung     TEXT,
  raum            TEXT,
  berechnung      TEXT,
  menge           NUMERIC,
  einheit         TEXT,
  -- Sketch-Modus: Base64 PNG-DataURL der ganzen Zeile
  sketch_data_url TEXT,
  notiz           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aufmass_positions_sheet
  ON public.aufmass_positions(sheet_id, sort_order);

-- ============================================================
-- RLS: Jeder Authenticated darf eigene Aufmaße + Admin alle.
-- ============================================================
ALTER TABLE public.aufmass_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aufmass_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own aufmass sheets"   ON public.aufmass_sheets;
DROP POLICY IF EXISTS "Users insert own aufmass sheets" ON public.aufmass_sheets;
DROP POLICY IF EXISTS "Users update own aufmass sheets" ON public.aufmass_sheets;
DROP POLICY IF EXISTS "Users delete own aufmass sheets" ON public.aufmass_sheets;

CREATE POLICY "Users view own aufmass sheets" ON public.aufmass_sheets
  FOR SELECT USING (
    user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role)
  );
CREATE POLICY "Users insert own aufmass sheets" ON public.aufmass_sheets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own aufmass sheets" ON public.aufmass_sheets
  FOR UPDATE USING (
    user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role)
  );
CREATE POLICY "Users delete own aufmass sheets" ON public.aufmass_sheets
  FOR DELETE USING (
    user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role)
  );

DROP POLICY IF EXISTS "Users view positions of own sheets"   ON public.aufmass_positions;
DROP POLICY IF EXISTS "Users insert positions of own sheets" ON public.aufmass_positions;
DROP POLICY IF EXISTS "Users update positions of own sheets" ON public.aufmass_positions;
DROP POLICY IF EXISTS "Users delete positions of own sheets" ON public.aufmass_positions;

CREATE POLICY "Users view positions of own sheets" ON public.aufmass_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_positions.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users insert positions of own sheets" ON public.aufmass_positions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_positions.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users update positions of own sheets" ON public.aufmass_positions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_positions.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users delete positions of own sheets" ON public.aufmass_positions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_positions.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );

-- ============================================================
-- Storage-Bucket fuer die Aufmass-PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-aufmass', 'project-aufmass', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated view aufmass files"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload aufmass files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update aufmass files" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete aufmass files"        ON storage.objects;

CREATE POLICY "Authenticated view aufmass files" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-aufmass' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated upload aufmass files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-aufmass' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update aufmass files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'project-aufmass' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete aufmass files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'project-aufmass'
    AND has_role(auth.uid(), 'administrator'::app_role)
  );
