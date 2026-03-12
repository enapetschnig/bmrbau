-- Fix RLS infinite recursion in safety_evaluations / safety_evaluation_employees

-- Helper function: checks if the current user created a given evaluation.
-- SECURITY DEFINER bypasses RLS on safety_evaluations, breaking the recursive loop.
CREATE OR REPLACE FUNCTION public.fn_user_created_evaluation(eval_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.safety_evaluations
    WHERE id = eval_id AND created_by = auth.uid()
  );
$$;

-- Drop the two policies that form the circular dependency
DROP POLICY IF EXISTS "Assigned employees can view evaluations" ON public.safety_evaluations;
DROP POLICY IF EXISTS "Vorarbeiter can manage evaluation employees for own evaluations" ON public.safety_evaluation_employees;

-- Recreate: employees who are assigned can see the evaluation
CREATE POLICY "Assigned employees can view evaluations"
ON public.safety_evaluations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.safety_evaluation_employees see
    WHERE see.evaluation_id = safety_evaluations.id AND see.user_id = auth.uid()
  )
);

-- Recreate: Vorarbeiter/creator can manage the employee list — uses SECURITY DEFINER
-- function so the inner query on safety_evaluations skips RLS (no recursion)
CREATE POLICY "Vorarbeiter can manage evaluation employees for own evaluations"
ON public.safety_evaluation_employees FOR ALL TO authenticated
USING (public.fn_user_created_evaluation(evaluation_id))
WITH CHECK (public.fn_user_created_evaluation(evaluation_id));
