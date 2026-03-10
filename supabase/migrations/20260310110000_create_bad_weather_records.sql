-- ============================================================
-- Schlechtwetterdokumentation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bad_weather_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  datum DATE NOT NULL,
  beginn_schlechtwetter TIME NOT NULL,
  ende_schlechtwetter TIME NOT NULL,
  schlechtwetter_stunden NUMERIC(5,2) NOT NULL,
  arbeitsstunden_vor_schlechtwetter NUMERIC(5,2) DEFAULT 0,
  wetter_art TEXT[] DEFAULT '{}',
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bad_weather_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bad weather records"
  ON public.bad_weather_records FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Users can insert own bad weather records"
  ON public.bad_weather_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bad weather records"
  ON public.bad_weather_records FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Users can delete own bad weather records"
  ON public.bad_weather_records FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.bad_weather_records;
