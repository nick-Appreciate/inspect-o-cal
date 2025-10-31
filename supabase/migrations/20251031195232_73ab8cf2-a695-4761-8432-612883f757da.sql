-- Add type column as text to store inspection type
ALTER TABLE public.inspection_templates
ADD COLUMN type TEXT;

-- Drop the type_id column since we're using hardcoded types now
ALTER TABLE public.inspection_templates
DROP COLUMN IF EXISTS type_id;