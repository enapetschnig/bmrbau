-- ============================================================
-- BMR BAU - Initiale Konfiguration
-- ============================================================
-- Saubere Admin-Konfiguration und App-Settings fuer BMR Bau.
-- Diese Migration ueberschreibt bewusst die vorherigen Admin-Setups
-- frueherer Whitelabel-Kunden und bildet die aktuelle Einrichtung ab.
-- ============================================================

-- 1. handle_new_user: Nur napetschnig.chris@gmail.com ist Default-Administrator
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role app_role;
BEGIN
  -- Default-Administrator fuer BMR Bau
  IF NEW.email = 'napetschnig.chris@gmail.com' THEN
    assigned_role := 'administrator';
  ELSE
    assigned_role := 'mitarbeiter';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  -- Neue Nutzer sind sofort aktiv (werden bei Bedarf im Admin-UI deaktiviert)
  INSERT INTO public.profiles (id, vorname, nachname, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', ''),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    true
  );

  RETURN NEW;
END;
$function$;

-- 2. ensure_user_profile: gleicher Admin-Check
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
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = current_user_id) THEN
    RETURN json_build_object('success', true, 'action', 'existing');
  END IF;

  SELECT email, raw_user_meta_data
  INTO user_email, user_meta
  FROM auth.users
  WHERE id = current_user_id;

  -- Default-Administrator fuer BMR Bau
  IF user_email = 'napetschnig.chris@gmail.com' THEN
    assigned_role := 'administrator';
  ELSE
    assigned_role := 'mitarbeiter';
  END IF;

  INSERT INTO public.profiles (id, vorname, nachname, is_active)
  VALUES (
    current_user_id,
    COALESCE(user_meta->>'vorname', ''),
    COALESCE(user_meta->>'nachname', ''),
    true
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'action', 'created',
    'role', assigned_role
  );
END;
$function$;

-- 3. App-Settings auf BMR Bau setzen (Platzhalter, kann in Einstellungen angepasst werden)
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('disturbance_report_email', 'office@bmrbau.at', now())
ON CONFLICT (key) DO UPDATE SET value = 'office@bmrbau.at', updated_at = now();
