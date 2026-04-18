-- ============================================================
-- Fix: fill_time_entry_week_type soll bestehende Werte nicht ueberschreiben
-- ============================================================
-- Der urspruengliche Trigger ueberschreibt week_type bei jedem UPDATE OF datum,
-- selbst wenn der Admin/User den Wochentyp bewusst manuell gesetzt hatte.
-- Fix: Bei UPDATE nur fuellen, wenn week_type explizit auf NULL gesetzt wurde
-- ODER wenn er noch nie befuellt war.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fill_time_entry_week_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.week_type IS NULL AND NEW.datum IS NOT NULL THEN
      NEW.week_type := public.buak_week_type_for_date(NEW.datum)::text;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Nur befuellen wenn der User den Wert explizit geleert hat (NULL gesetzt)
    -- UND ein Datum vorhanden ist. Wenn er einen Wert stehen lassen hat,
    -- bleibt der erhalten – auch bei Datums-Korrekturen.
    IF NEW.week_type IS NULL AND NEW.datum IS NOT NULL THEN
      NEW.week_type := public.buak_week_type_for_date(NEW.datum)::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
