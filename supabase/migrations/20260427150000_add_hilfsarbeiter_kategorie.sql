-- Neue Mitarbeiter-Kategorie 'hilfsarbeiter' mit denselben Rechten wie 'lehrling'.
-- 1) CHECK-Constraint auf employees.kategorie erweitern
-- 2) Menue-Sichtbarkeit (role_menu_settings) von lehrling kopieren
-- 3) Jahresgrobplanung-Rollen-JSON erweitern (hilfsarbeiter:false, wie lehrling)

-- 1. Constraint erweitern
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_kategorie_check;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_kategorie_check
  CHECK (kategorie IN ('lehrling', 'hilfsarbeiter', 'facharbeiter', 'vorarbeiter', 'extern'));

-- 2. Menue-Sichtbarkeit fuer hilfsarbeiter aus lehrling kopieren
INSERT INTO role_menu_settings (role, menu_key, visible)
SELECT 'hilfsarbeiter', menu_key, visible
FROM role_menu_settings
WHERE role = 'lehrling'
ON CONFLICT (role, menu_key) DO NOTHING;

-- 3. Jahresgrobplanung-Rollen-JSON aktualisieren
UPDATE app_settings
SET value = '{"admin":true,"vorarbeiter":true,"facharbeiter":false,"lehrling":false,"hilfsarbeiter":false,"extern":false}'
WHERE key = 'jahresgrobplanung_rollen';
