-- ============================================================
-- Aufmaßblätter: Kunden-Unterschrift (analog daily_reports)
-- ============================================================

ALTER TABLE public.aufmass_sheets
  ADD COLUMN IF NOT EXISTS unterschrift_kunde TEXT,
  ADD COLUMN IF NOT EXISTS unterschrift_name  TEXT,
  ADD COLUMN IF NOT EXISTS unterschrift_am    TIMESTAMPTZ;
