-- ============================================================
-- Aufmaßblatt-Fotos: pro Position UND/ODER global pro Sheet
-- ============================================================
-- position_id ist NULLABLE: ist null = das Foto haengt am gesamten
-- Aufmaßblatt (Anhang am Ende), nicht an einer einzelnen Position.

CREATE TABLE IF NOT EXISTS public.aufmass_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id     UUID NOT NULL REFERENCES public.aufmass_sheets(id) ON DELETE CASCADE,
  position_id  UUID REFERENCES public.aufmass_positions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path    TEXT NOT NULL,   -- Pfad in storage.objects (project-aufmass)
  file_name    TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aufmass_photos_sheet
  ON public.aufmass_photos(sheet_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_aufmass_photos_position
  ON public.aufmass_photos(position_id);

ALTER TABLE public.aufmass_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view aufmass photos"   ON public.aufmass_photos;
DROP POLICY IF EXISTS "Users insert aufmass photos" ON public.aufmass_photos;
DROP POLICY IF EXISTS "Users update aufmass photos" ON public.aufmass_photos;
DROP POLICY IF EXISTS "Users delete aufmass photos" ON public.aufmass_photos;

CREATE POLICY "Users view aufmass photos" ON public.aufmass_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_photos.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users insert aufmass photos" ON public.aufmass_photos
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_photos.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users update aufmass photos" ON public.aufmass_photos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_photos.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
CREATE POLICY "Users delete aufmass photos" ON public.aufmass_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.aufmass_sheets s
      WHERE s.id = aufmass_photos.sheet_id
        AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'administrator'::app_role))
    )
  );
