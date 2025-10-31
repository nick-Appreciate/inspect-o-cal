-- Add duration field to inspections (in minutes)
ALTER TABLE public.inspections ADD COLUMN duration INTEGER DEFAULT 60;