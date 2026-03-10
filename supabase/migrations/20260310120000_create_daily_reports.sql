-- ============================================================
-- Tagesbericht & Zwischenbericht
-- ============================================================

-- Haupttabelle
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  report_type TEXT NOT NULL DEFAULT 'tagesbericht'
    CHECK (report_type IN ('tagesbericht', 'zwischenbericht')),
  datum DATE NOT NULL,
  temperatur_min NUMERIC(4,1),
  temperatur_max NUMERIC(4,1),
  wetter TEXT[] DEFAULT '{}',
  geschoss TEXT[] DEFAULT '{}',
  beschreibung TEXT NOT NULL DEFAULT '',
  notizen TEXT,
  sicherheitscheckliste JSONB DEFAULT '[]'::jsonb,
  sicherheit_bestaetigt BOOLEAN DEFAULT false,
  unterschrift_kunde TEXT,
  unterschrift_am TIMESTAMPTZ,
  unterschrift_name TEXT,
  status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'gesendet', 'abgeschlossen')),
  pdf_gesendet_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fotos
CREATE TABLE IF NOT EXISTS public.daily_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mitarbeiter-Zuordnung
CREATE TABLE IF NOT EXISTS public.daily_report_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  is_main BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tätigkeiten pro Geschoss
CREATE TABLE IF NOT EXISTS public.daily_report_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  geschoss TEXT NOT NULL CHECK (geschoss IN ('aussen', 'keller', 'eg', 'og', 'dg')),
  beschreibung TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS für daily_reports
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily reports" ON public.daily_reports
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Users can insert own daily reports" ON public.daily_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily reports" ON public.daily_reports
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Users can delete own daily reports" ON public.daily_reports
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

-- RLS für daily_report_photos
ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily report photos" ON public.daily_report_photos
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Users can insert daily report photos" ON public.daily_report_photos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own daily report photos" ON public.daily_report_photos
  FOR DELETE USING (user_id = auth.uid());

-- RLS für daily_report_workers
ALTER TABLE public.daily_report_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily report workers" ON public.daily_report_workers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert daily report workers" ON public.daily_report_workers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete daily report workers" ON public.daily_report_workers
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS für daily_report_activities
ALTER TABLE public.daily_report_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily report activities" ON public.daily_report_activities
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage daily report activities" ON public.daily_report_activities
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-report-photos', 'daily-report-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can upload daily report photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'daily-report-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view daily report photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'daily-report-photos');

CREATE POLICY "Users can delete own daily report photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'daily-report-photos' AND auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;
