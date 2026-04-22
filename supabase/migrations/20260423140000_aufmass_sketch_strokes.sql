-- ============================================================
-- Aufmaß-Positionen: sketch_strokes fuer editierbare Skizzen
-- ============================================================
-- Das PNG (sketch_data_url) bleibt als "Render"-Form fuer das PDF,
-- zusaetzlich speichern wir die Strokes als JSON-Liste, damit man
-- die Skizze spaeter wieder laden und weiterzeichnen, Linien
-- loeschen oder rueckgaengig machen kann.
--
-- Format: [{ type: 'pen'|'line'|'rect'|'arrow'|'eraser', points: [{x,y}], width, color }]
-- Koordinaten normalisiert 0..1 relativ zum Canvas, damit die
-- Skizze auf beliebigen Canvas-Groessen (inline + Vollbild)
-- gleich aussieht.

ALTER TABLE public.aufmass_positions
  ADD COLUMN IF NOT EXISTS sketch_strokes JSONB;
