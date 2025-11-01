-- Create units table
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, name)
);

-- Enable RLS on units table
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for units
CREATE POLICY "Users can view all units"
ON public.units
FOR SELECT
USING (true);

CREATE POLICY "Users can create units"
ON public.units
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own units"
ON public.units
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own units"
ON public.units
FOR DELETE
USING (auth.uid() = created_by);

-- Add unit_id column to inspections table
ALTER TABLE public.inspections
ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;