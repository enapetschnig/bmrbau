-- Phase D Schritt 3: Geräte-/Inventarverwaltung

CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kategorie TEXT NOT NULL CHECK (kategorie IN ('werkzeug','maschine','fahrzeug','geruest','sicherheitsausruestung')),
  seriennummer TEXT,
  kaufdatum DATE,
  zustand TEXT NOT NULL DEFAULT 'gut' CHECK (zustand IN ('gut','beschaedigt','in_reparatur','ausgemustert')),
  standort_typ TEXT NOT NULL DEFAULT 'lager' CHECK (standort_typ IN ('lager','baustelle')),
  standort_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  notizen TEXT,
  naechste_wartung DATE,
  wartungsintervall_monate INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.equipment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  von_typ TEXT NOT NULL CHECK (von_typ IN ('lager','baustelle')),
  von_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  nach_typ TEXT NOT NULL CHECK (nach_typ IN ('lager','baustelle')),
  nach_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  transferiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferiert_von UUID NOT NULL REFERENCES public.profiles(id),
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX equipment_kategorie_idx ON public.equipment(kategorie);
CREATE INDEX equipment_zustand_idx ON public.equipment(zustand);
CREATE INDEX equipment_standort_idx ON public.equipment(standort_typ, standort_project_id);
CREATE INDEX equipment_transfers_equipment_id_idx ON public.equipment_transfers(equipment_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_equipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_equipment_updated_at();

-- RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle koennen Geraete lesen" ON public.equipment FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins koennen Geraete erstellen" ON public.equipment FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator'));

CREATE POLICY "Admins koennen Geraete aktualisieren" ON public.equipment FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator'));

CREATE POLICY "Admins koennen Geraete loeschen" ON public.equipment FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator'));

CREATE POLICY "Alle koennen Transfers lesen" ON public.equipment_transfers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins koennen Transfers erstellen" ON public.equipment_transfers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'administrator'));

-- RPC für atomaren Transfer
CREATE OR REPLACE FUNCTION public.transfer_equipment(
  p_equipment_id UUID, p_nach_typ TEXT, p_nach_project_id UUID DEFAULT NULL, p_notizen TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_von_typ TEXT; v_von_project_id UUID;
BEGIN
  SELECT standort_typ, standort_project_id INTO v_von_typ, v_von_project_id FROM equipment WHERE id = p_equipment_id;
  INSERT INTO equipment_transfers (equipment_id, von_typ, von_project_id, nach_typ, nach_project_id, transferiert_von, notizen)
  VALUES (p_equipment_id, v_von_typ, v_von_project_id, p_nach_typ, p_nach_project_id, auth.uid(), p_notizen);
  UPDATE equipment SET standort_typ = p_nach_typ, standort_project_id = p_nach_project_id WHERE id = p_equipment_id;
END; $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;
