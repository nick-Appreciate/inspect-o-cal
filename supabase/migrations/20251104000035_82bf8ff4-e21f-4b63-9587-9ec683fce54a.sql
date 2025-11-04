-- Add status column to inspections table for pass/fail tracking
ALTER TABLE public.inspections 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'passed', 'failed'));

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);

-- Update existing inspections that have follow-ups to mark them as failed
UPDATE public.inspections parent
SET status = 'failed'
WHERE EXISTS (
  SELECT 1 FROM public.inspections child
  WHERE child.parent_inspection_id = parent.id
) AND parent.status = 'pending';