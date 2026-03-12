-- Add personal_answers column to store per-employee checkbox answers alongside their signature
ALTER TABLE public.safety_evaluation_signatures
  ADD COLUMN IF NOT EXISTS personal_answers JSONB DEFAULT '[]';
