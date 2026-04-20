-- ============================================================
-- Regieberichte: Menue-Sichtbarkeit fuer alle Rollen freischalten
-- ============================================================
-- Jeder Mitarbeiter darf seine eigenen Regieberichte sehen und anlegen
-- (RLS-seitig schon korrekt: users see own, admins see all). Im UI-Menue
-- war der Eintrag "regiearbeiten" bisher nur fuer Vorarbeiter + Admin
-- sichtbar. Wir oeffnen ihn fuer alle internen Rollen.
-- ============================================================

INSERT INTO public.role_menu_settings (role, menu_key, visible) VALUES
  ('extern',       'regiearbeiten', true),
  ('lehrling',     'regiearbeiten', true),
  ('facharbeiter', 'regiearbeiten', true),
  ('vorarbeiter',  'regiearbeiten', true),
  ('admin',        'regiearbeiten', true)
ON CONFLICT (role, menu_key) DO UPDATE SET visible = true;
