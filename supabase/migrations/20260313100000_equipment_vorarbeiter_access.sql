-- Geräteverwaltung: Vorarbeiter und Facharbeiter erhalten Verwaltungszugriff

-- Alte Admin-Only-Policies entfernen
DROP POLICY IF EXISTS "Admins koennen Geraete erstellen" ON public.equipment;
DROP POLICY IF EXISTS "Admins koennen Geraete aktualisieren" ON public.equipment;
DROP POLICY IF EXISTS "Admins koennen Geraete loeschen" ON public.equipment;
DROP POLICY IF EXISTS "Admins koennen Transfers erstellen" ON public.equipment_transfers;

-- Neue Policies: Administrator (via user_roles) ODER Vorarbeiter/Facharbeiter (via employees.kategorie)
CREATE POLICY "Berechtigte koennen Geraete erstellen" ON public.equipment FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
    OR EXISTS (SELECT 1 FROM public.employees WHERE employees.user_id = auth.uid() AND employees.kategorie IN ('vorarbeiter','facharbeiter'))
  );

CREATE POLICY "Berechtigte koennen Geraete aktualisieren" ON public.equipment FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
    OR EXISTS (SELECT 1 FROM public.employees WHERE employees.user_id = auth.uid() AND employees.kategorie IN ('vorarbeiter','facharbeiter'))
  );

CREATE POLICY "Berechtigte koennen Geraete loeschen" ON public.equipment FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
    OR EXISTS (SELECT 1 FROM public.employees WHERE employees.user_id = auth.uid() AND employees.kategorie IN ('vorarbeiter','facharbeiter'))
  );

CREATE POLICY "Berechtigte koennen Transfers erstellen" ON public.equipment_transfers FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator')
    OR EXISTS (SELECT 1 FROM public.employees WHERE employees.user_id = auth.uid() AND employees.kategorie IN ('vorarbeiter','facharbeiter'))
  );

-- Menüsichtbarkeit für Vorarbeiter und Facharbeiter aktivieren
UPDATE public.role_menu_settings
  SET visible = true
  WHERE menu_key = 'gerateverwaltung'
  AND role IN ('vorarbeiter','facharbeiter');
