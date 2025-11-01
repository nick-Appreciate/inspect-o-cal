-- Create inspection_runs table to track each checklist completion separately
CREATE TABLE public.inspection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.inspection_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_by UUID NOT NULL REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.inspection_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all inspection runs"
  ON public.inspection_runs
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create inspection runs"
  ON public.inspection_runs
  FOR INSERT
  WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Users can update inspection runs"
  ON public.inspection_runs
  FOR UPDATE
  USING (true);

-- Add inspection_run_id to subtasks table
ALTER TABLE public.subtasks 
ADD COLUMN inspection_run_id UUID REFERENCES public.inspection_runs(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_inspection_runs_inspection_id ON public.inspection_runs(inspection_id);
CREATE INDEX idx_subtasks_inspection_run_id ON public.subtasks(inspection_run_id);

COMMENT ON TABLE public.inspection_runs IS 'Tracks each time a checklist/template is run for an inspection';
COMMENT ON COLUMN public.inspection_runs.started_by IS 'User who started this inspection run';
COMMENT ON COLUMN public.inspection_runs.completed_by IS 'User who completed this inspection run';
COMMENT ON COLUMN public.subtasks.inspection_run_id IS 'Links subtask to specific inspection run';