-- Add parent inspection relationship to inspections table
ALTER TABLE public.inspections
ADD COLUMN parent_inspection_id uuid REFERENCES public.inspections(id) ON DELETE SET NULL;

-- Add index for parent inspection lookups
CREATE INDEX idx_inspections_parent_id ON public.inspections(parent_inspection_id);

-- Add original inspection tracking to subtasks
ALTER TABLE public.subtasks
ADD COLUMN original_inspection_id uuid REFERENCES public.inspections(id) ON DELETE CASCADE;

-- Set original_inspection_id to inspection_id for existing subtasks
UPDATE public.subtasks
SET original_inspection_id = inspection_id
WHERE original_inspection_id IS NULL;

-- Make original_inspection_id NOT NULL after backfilling
ALTER TABLE public.subtasks
ALTER COLUMN original_inspection_id SET NOT NULL;

-- Add index for original inspection lookups
CREATE INDEX idx_subtasks_original_inspection_id ON public.subtasks(original_inspection_id);

-- Add comment to explain the columns
COMMENT ON COLUMN public.inspections.parent_inspection_id IS 'Links to parent inspection for follow-up/re-inspections';
COMMENT ON COLUMN public.subtasks.original_inspection_id IS 'Tracks which inspection this subtask was originally created for';