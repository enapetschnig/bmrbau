-- ============================================================
-- Projekt-Fotoordner: pro Projekt eigene Unterordner fuer Fotos
-- Speichert nur die Ordner-Namen. Die Zuordnung der Fotos passiert
-- ueber documents.sub_type (= Ordner-Name) bei typ='photos'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_photo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_photo_folders_project_id
  ON public.project_photo_folders(project_id);

ALTER TABLE public.project_photo_folders ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authentifizierten Nutzer (analog documents)
CREATE POLICY "Authenticated users can view photo folders"
  ON public.project_photo_folders FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anlegen: alle authentifizierten Nutzer, created_by muss eigener uid sein
CREATE POLICY "Users can insert photo folders"
  ON public.project_photo_folders FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Loeschen: alle authentifizierten Nutzer (Wer hochladen darf, darf auch
-- Ordner verwalten – siehe Produktentscheidung). Admins via separater Policy
-- nicht noetig, da die Insert-Policy auch fuer Admin gilt.
CREATE POLICY "Authenticated users can delete photo folders"
  ON public.project_photo_folders FOR DELETE
  USING (auth.uid() IS NOT NULL);
