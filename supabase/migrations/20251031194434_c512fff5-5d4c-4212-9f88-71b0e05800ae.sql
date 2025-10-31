-- Create inspection_types table
CREATE TABLE public.inspection_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_types ENABLE ROW LEVEL SECURITY;

-- Create policies for inspection_types
CREATE POLICY "Users can view all inspection types"
ON public.inspection_types
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own inspection types"
ON public.inspection_types
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inspection types"
ON public.inspection_types
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own inspection types"
ON public.inspection_types
FOR DELETE
USING (auth.uid() = created_by);

-- Add type_id to inspection_templates
ALTER TABLE public.inspection_templates
ADD COLUMN type_id UUID REFERENCES public.inspection_types(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_inspection_templates_type_id ON public.inspection_templates(type_id);