-- Safety Evaluations & Briefings

CREATE TABLE public.safety_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  titel TEXT NOT NULL,
  typ TEXT NOT NULL CHECK (typ IN ('evaluierung', 'sicherheitsunterweisung')),
  kategorie TEXT,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  filled_answers JSONB DEFAULT '[]'::jsonb,
  diskussion_notizen TEXT,
  status TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'ausgefuellt', 'diskutiert', 'abgeschlossen')),
  excel_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.safety_evaluation_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.safety_evaluations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(evaluation_id, user_id)
);

CREATE TABLE public.safety_evaluation_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.safety_evaluations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  unterschrift TEXT NOT NULL,
  unterschrift_name TEXT NOT NULL,
  unterschrieben_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(evaluation_id, user_id)
);

-- Indexes
CREATE INDEX idx_safety_evaluations_project ON safety_evaluations(project_id);
CREATE INDEX idx_safety_evaluations_status ON safety_evaluations(status);
CREATE INDEX idx_safety_eval_signatures_user ON safety_evaluation_signatures(user_id);
CREATE INDEX idx_safety_eval_employees_user ON safety_evaluation_employees(user_id);

-- Enable RLS
ALTER TABLE safety_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_evaluation_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_evaluation_signatures ENABLE ROW LEVEL SECURITY;

-- RLS: safety_evaluations
CREATE POLICY "Admins can do everything with evaluations"
ON safety_evaluations FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
);

CREATE POLICY "Creators can manage own evaluations"
ON safety_evaluations FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Assigned employees can view evaluations"
ON safety_evaluations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM safety_evaluation_employees
    WHERE evaluation_id = id AND user_id = auth.uid()
  )
);

-- RLS: safety_evaluation_employees
CREATE POLICY "Admins can manage evaluation employees"
ON safety_evaluation_employees FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
);

CREATE POLICY "Vorarbeiter can manage evaluation employees for own evaluations"
ON safety_evaluation_employees FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM safety_evaluations
    WHERE id = evaluation_id AND created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM safety_evaluations
    WHERE id = evaluation_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Employees can see their own assignments"
ON safety_evaluation_employees FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS: safety_evaluation_signatures
CREATE POLICY "Users can insert own signature"
ON safety_evaluation_signatures FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Signatures visible if evaluation is visible"
ON safety_evaluation_signatures FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM safety_evaluations
    WHERE id = evaluation_id
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'administrator')
      OR EXISTS (SELECT 1 FROM safety_evaluation_employees WHERE evaluation_id = safety_evaluation_signatures.evaluation_id AND user_id = auth.uid())
    )
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-evaluation-files', 'safety-evaluation-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can upload safety files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'safety-evaluation-files');

CREATE POLICY "Authenticated users can view safety files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'safety-evaluation-files');

CREATE POLICY "Admins can delete safety files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'safety-evaluation-files');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_evaluations;
