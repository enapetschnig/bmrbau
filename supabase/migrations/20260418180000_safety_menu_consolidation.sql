-- ============================================================
-- Menu-Konsolidierung: evaluierungen + arbeitsschutz -> sicherheit
-- ============================================================
-- Die zwei getrennten Menu-Keys werden zu einem zusammengefuehrt.
-- Pro Rolle wird "sicherheit" sichtbar, wenn mindestens einer der
-- alten Keys sichtbar war (logisches OR, defensiv gewaehlt).
-- Alte Keys bleiben als No-Op in der Tabelle liegen -> kein Datenverlust,
-- falls sie jemals wiederbelebt werden muessen.
-- ============================================================

INSERT INTO public.role_menu_settings (role, menu_key, visible)
SELECT
  r.role,
  'sicherheit'::text                                       AS menu_key,
  -- Wenn fuer diese Rolle einer der alten Keys sichtbar war -> true
  COALESCE(bool_or(r.visible), true)                       AS visible
FROM public.role_menu_settings r
WHERE r.menu_key IN ('evaluierungen', 'arbeitsschutz')
GROUP BY r.role
ON CONFLICT (role, menu_key) DO UPDATE
  SET visible = EXCLUDED.visible;

-- Fuer Rollen, die weder evaluierungen noch arbeitsschutz in der Tabelle
-- stehen haben (Alt-Setups): einen sinnvollen Default setzen.
INSERT INTO public.role_menu_settings (role, menu_key, visible) VALUES
  ('extern',       'sicherheit', false),
  ('lehrling',     'sicherheit', true),
  ('facharbeiter', 'sicherheit', true),
  ('vorarbeiter',  'sicherheit', true),
  ('admin',        'sicherheit', true)
ON CONFLICT (role, menu_key) DO NOTHING;
