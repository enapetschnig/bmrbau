-- ============================================================
-- Employees: Regelarbeitszeit auf BMR-BUAK-Default resetten
-- ============================================================
-- Bestehende Mitarbeiter haben noch den alten Schafferhofer-Schedule
-- (Mo-Di 06:30-17:00, Mi-Do 07:00-17:00, Fr frei). Dadurch zeigt die
-- Zeiterfassungs-Aufschluesselung "Mo-Do + kein Fr", obwohl der Wochentyp-
-- Badge "Lange Woche (Mo-Fr)" sagt.
-- Migration 20260418140000 hatte den Default nur fuer NULL-regelarbeitszeit
-- gesetzt - bestehende Zeilen wurden uebersprungen.
--
-- Diese Migration:
-- - setzt fuer alle internen Mitarbeiter (nicht Extern) den BMR-BUAK-
--   Default ein (lang + kurz) - falls regelarbeitszeit noch Schafferhofer
--   entspricht oder regelarbeitszeit_kurz leer ist.
-- - Mitarbeiter mit bewusst individualisiertem Plan (Lehrling, o. a.)
--   werden NICHT ueberschrieben - wir checken auf das Schafferhofer-
--   Merkmal (mo.start = 06:30 AND fr.hours = 0).
-- ============================================================

DO $$
DECLARE
  v_lang JSONB := '{
    "mo": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "di": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "mi": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "do": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "fr": { "start": "07:00", "end": "15:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 7.75 },
    "sa": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "so": { "start": null, "end": null, "pause": 0, "hours": 0 }
  }'::jsonb;

  v_kurz JSONB := '{
    "mo": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "di": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "mi": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "do": { "start": "07:00", "end": "16:45", "pause": 60, "pause_start": "12:00", "pause_end": "13:00", "hours": 8.75 },
    "fr": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "sa": { "start": null, "end": null, "pause": 0, "hours": 0 },
    "so": { "start": null, "end": null, "pause": 0, "hours": 0 }
  }'::jsonb;
BEGIN
  -- Lange-Woche-Plan: nur ueberschreiben wenn Schafferhofer-Muster erkannt
  -- (Mo-Start 06:30 und Fr hours = 0) oder regelarbeitszeit komplett fehlt.
  UPDATE public.employees
     SET regelarbeitszeit = v_lang
   WHERE COALESCE(is_external, false) = false
     AND COALESCE(kategorie, '') NOT IN ('extern')
     AND (
       regelarbeitszeit IS NULL
       OR regelarbeitszeit = '{}'::jsonb
       OR (
         regelarbeitszeit->'mo'->>'start' = '06:30'
         AND (regelarbeitszeit->'fr'->>'hours')::numeric = 0
       )
     );

  -- Kurze-Woche-Plan: ueberall ergaenzen wo leer.
  UPDATE public.employees
     SET regelarbeitszeit_kurz = v_kurz
   WHERE COALESCE(is_external, false) = false
     AND COALESCE(kategorie, '') NOT IN ('extern')
     AND (regelarbeitszeit_kurz IS NULL OR regelarbeitszeit_kurz = '{}'::jsonb);
END $$;
