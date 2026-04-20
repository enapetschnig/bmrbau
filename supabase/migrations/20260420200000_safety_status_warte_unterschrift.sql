-- ============================================================
-- Safety-Evaluations: Status 'warte_auf_unterschrift' zulassen
-- ============================================================
-- Der Code (SafetyEvaluations.tsx, STATUS_LABELS im Detail-View) verwendet
-- 'warte_auf_unterschrift' als aktiven Status. Der alte Check-Constraint
-- kennt diesen Wert nicht -> Insert schlaegt mit "violates check constraint
-- safety_evaluations_status_check" fehl. Wir erweitern den Constraint.
-- ============================================================

ALTER TABLE public.safety_evaluations
  DROP CONSTRAINT IF EXISTS safety_evaluations_status_check;

ALTER TABLE public.safety_evaluations
  ADD CONSTRAINT safety_evaluations_status_check
  CHECK (status = ANY (ARRAY[
    'entwurf'::text,
    'warte_auf_unterschrift'::text,
    'ausgefuellt'::text,
    'diskutiert'::text,
    'abgeschlossen'::text
  ]));
