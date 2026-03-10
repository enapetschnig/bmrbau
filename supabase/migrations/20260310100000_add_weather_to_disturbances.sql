-- ============================================================
-- Wetter, Temperatur und Geschoss auf Regieberichte (disturbances)
-- ============================================================

ALTER TABLE public.disturbances
ADD COLUMN IF NOT EXISTS temperatur_min NUMERIC(4,1);

ALTER TABLE public.disturbances
ADD COLUMN IF NOT EXISTS temperatur_max NUMERIC(4,1);

ALTER TABLE public.disturbances
ADD COLUMN IF NOT EXISTS wetter TEXT[] DEFAULT '{}';

ALTER TABLE public.disturbances
ADD COLUMN IF NOT EXISTS geschoss TEXT[] DEFAULT '{}';
