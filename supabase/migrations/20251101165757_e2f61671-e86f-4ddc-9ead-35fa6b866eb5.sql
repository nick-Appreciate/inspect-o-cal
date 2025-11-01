-- Make created_by column NOT NULL on subtasks table (required for RLS)
-- First, set any NULL values to a system user (this shouldn't happen in practice)
UPDATE subtasks SET created_by = auth.uid() WHERE created_by IS NULL;

-- Now make the column NOT NULL
ALTER TABLE public.subtasks 
ALTER COLUMN created_by SET NOT NULL;

-- Verify all other tables with RLS have proper NOT NULL constraints on user_id columns
-- Check inspection_templates
ALTER TABLE public.inspection_templates 
ALTER COLUMN created_by SET NOT NULL;

-- Check inspection_types
ALTER TABLE public.inspection_types 
ALTER COLUMN created_by SET NOT NULL;

-- Check inspections
ALTER TABLE public.inspections 
ALTER COLUMN created_by SET NOT NULL;

-- Check inventory_types
ALTER TABLE public.inventory_types 
ALTER COLUMN created_by SET NOT NULL;

-- Check properties
ALTER TABLE public.properties 
ALTER COLUMN created_by SET NOT NULL;