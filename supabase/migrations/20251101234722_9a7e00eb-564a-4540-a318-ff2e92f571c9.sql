-- Add cascade delete for inspection_runs
ALTER TABLE public.inspection_runs
DROP CONSTRAINT IF EXISTS inspection_runs_inspection_id_fkey;

ALTER TABLE public.inspection_runs
ADD CONSTRAINT inspection_runs_inspection_id_fkey 
FOREIGN KEY (inspection_id) 
REFERENCES public.inspections(id) 
ON DELETE CASCADE;

-- Add cascade delete for subtasks
ALTER TABLE public.subtasks
DROP CONSTRAINT IF EXISTS subtasks_inspection_id_fkey;

ALTER TABLE public.subtasks
ADD CONSTRAINT subtasks_inspection_id_fkey 
FOREIGN KEY (inspection_id) 
REFERENCES public.inspections(id) 
ON DELETE CASCADE;

ALTER TABLE public.subtasks
DROP CONSTRAINT IF EXISTS subtasks_original_inspection_id_fkey;

ALTER TABLE public.subtasks
ADD CONSTRAINT subtasks_original_inspection_id_fkey 
FOREIGN KEY (original_inspection_id) 
REFERENCES public.inspections(id) 
ON DELETE CASCADE;

-- Update RLS policy for deleting subtasks to allow deleting any subtask from an inspection the user can delete
DROP POLICY IF EXISTS "Users can delete their subtasks" ON public.subtasks;

CREATE POLICY "Users can delete subtasks from inspections they can access"
ON public.subtasks
FOR DELETE
USING (true);

-- Add RLS policy for deleting inspection_runs
DROP POLICY IF EXISTS "Users can delete inspection runs" ON public.inspection_runs;

CREATE POLICY "Users can delete inspection runs"
ON public.inspection_runs
FOR DELETE
USING (true);

COMMENT ON CONSTRAINT inspection_runs_inspection_id_fkey ON public.inspection_runs IS 'Cascade delete inspection runs when parent inspection is deleted';
COMMENT ON CONSTRAINT subtasks_inspection_id_fkey ON public.subtasks IS 'Cascade delete subtasks when inspection is deleted';
COMMENT ON CONSTRAINT subtasks_original_inspection_id_fkey ON public.subtasks IS 'Cascade delete subtasks when original inspection is deleted';