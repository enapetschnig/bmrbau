-- ============================================================
-- Regiebericht <-> Zeiteintrag: Cascade-Delete
-- ============================================================
-- Der Regiebericht legt automatisch einen time_entries-Eintrag mit
-- disturbance_id an. Wenn der Regiebericht geloescht wird, soll der
-- zugehoerige Zeiteintrag ebenfalls verschwinden - sonst bleibt eine
-- Waisenzeile in time_entries zurueck, die in der Stundenauswertung
-- auftaucht aber auf keinen aktiven Regiebericht mehr verweist.
--
-- Vorher: ON DELETE SET NULL (disturbance_id wurde null gesetzt)
-- Nachher: ON DELETE CASCADE (time_entry wird mit-geloescht)
-- ============================================================

ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_disturbance_id_fkey;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_disturbance_id_fkey
  FOREIGN KEY (disturbance_id)
  REFERENCES public.disturbances(id)
  ON DELETE CASCADE;
