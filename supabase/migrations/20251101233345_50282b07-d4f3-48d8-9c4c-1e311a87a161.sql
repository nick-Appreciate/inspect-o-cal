-- Add completed_by column to inspections table to track who completed the inspection
ALTER TABLE public.inspections 
ADD COLUMN completed_by uuid REFERENCES auth.users(id);

-- Create index for better query performance
CREATE INDEX idx_inspections_completed_by ON public.inspections(completed_by);

COMMENT ON COLUMN public.inspections.completed_by IS 'User who marked the inspection as completed';