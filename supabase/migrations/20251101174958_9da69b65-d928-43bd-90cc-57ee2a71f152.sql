-- Add completed field to inspections table
ALTER TABLE public.inspections 
ADD COLUMN completed boolean DEFAULT false;