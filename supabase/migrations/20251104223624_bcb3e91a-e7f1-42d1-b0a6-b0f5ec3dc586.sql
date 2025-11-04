-- Add unit_id to inspection_runs to link runs to units for multi-unit grouping
ALTER TABLE public.inspection_runs
ADD COLUMN IF NOT EXISTS unit_id uuid NULL;

-- Add foreign key to units
DO $$ BEGIN
  ALTER TABLE public.inspection_runs
  ADD CONSTRAINT inspection_runs_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_inspection_runs_inspection_id ON public.inspection_runs(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_runs_template_id ON public.inspection_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_inspection_runs_unit_id ON public.inspection_runs(unit_id);
