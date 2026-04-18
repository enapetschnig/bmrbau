-- ============================================================
-- BMR Bau: Default-Admin bei neuen Registrierungen
-- ============================================================
-- Die aeltere Migration 20260311050000_new_users_inactive_by_default.sql
-- checkt hartcodiert auf 'holzknecht.natursteine@gmail.com' (ehemaliger
-- Whitelabel-Kunde). Diese Migration ersetzt die Logik durch eine
-- BMR-spezifische Liste, damit der Default-Admin sich selbst registrieren
-- kann ohne manuellen Eingriff, und alle anderen User vom Admin
-- freigeschaltet werden muessen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role app_role;
  is_default_admin boolean;
BEGIN
  -- Default-Admin fuer BMR Bau (kann spaeter im Admin-UI erweitert werden)
  is_default_admin := NEW.email = 'napetschnig.chris@gmail.com';
  assigned_role := CASE WHEN is_default_admin THEN 'administrator'::app_role ELSE 'mitarbeiter'::app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  -- Default-Admin direkt aktiv; alle anderen muessen vom Admin freigeschaltet werden.
  INSERT INTO public.profiles (id, vorname, nachname, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', ''),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    is_default_admin
  );

  RETURN NEW;
END;
$function$;

-- Gleicher Check fuer die manuelle Profile-Sync-RPC
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  user_email text;
  user_meta jsonb;
  assigned_role app_role;
  is_default_admin boolean;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = current_user_id) THEN
    RETURN json_build_object('success', true, 'action', 'existing');
  END IF;

  SELECT email, raw_user_meta_data INTO user_email, user_meta
  FROM auth.users WHERE id = current_user_id;

  is_default_admin := user_email = 'napetschnig.chris@gmail.com';
  assigned_role := CASE WHEN is_default_admin THEN 'administrator'::app_role ELSE 'mitarbeiter'::app_role END;

  INSERT INTO public.profiles (id, vorname, nachname, is_active)
  VALUES (
    current_user_id,
    COALESCE(user_meta->>'vorname', ''),
    COALESCE(user_meta->>'nachname', ''),
    is_default_admin
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object('success', true, 'action', 'created', 'role', assigned_role);
END;
$function$;

-- Bereits registrierte Default-Admins nachziehen (idempotent)
UPDATE public.profiles
SET is_active = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'napetschnig.chris@gmail.com'
)
AND is_active = false;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'administrator'::app_role
FROM auth.users u
WHERE u.email = 'napetschnig.chris@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
