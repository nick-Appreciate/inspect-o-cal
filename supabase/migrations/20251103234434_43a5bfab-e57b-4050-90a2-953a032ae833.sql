-- Add archived column to inspections table for soft delete
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster queries excluding archived inspections
CREATE INDEX IF NOT EXISTS idx_inspections_archived ON public.inspections(archived);

-- Update existing queries to filter out archived by default
-- The archived column allows keeping data for analytics while hiding from regular views