-- ============================================================
-- Regiebericht: PDF-Anhaenge (werden an das Haupt-PDF angehaengt)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.disturbance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disturbance_id uuid NOT NULL REFERENCES public.disturbances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disturbance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view disturbance attachments"
ON public.disturbance_attachments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own disturbance attachments"
ON public.disturbance_attachments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own disturbance attachments"
ON public.disturbance_attachments FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'administrator'));

CREATE INDEX IF NOT EXISTS idx_disturbance_attachments_disturbance
  ON public.disturbance_attachments (disturbance_id);

-- Storage-Bucket: public, damit die Edge-Function die Datei per
-- ueber die oeffentliche URL einfach abrufen kann (gleicher Flow wie
-- disturbance-photos).
INSERT INTO storage.buckets (id, name, public)
VALUES ('disturbance-attachments', 'disturbance-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload disturbance attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'disturbance-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view disturbance attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'disturbance-attachments');

CREATE POLICY "Users can delete own disturbance attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'disturbance-attachments' AND auth.uid() IS NOT NULL);
