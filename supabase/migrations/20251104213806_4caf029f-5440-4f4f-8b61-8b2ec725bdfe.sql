-- Create inspection_unit_templates table to support multi-unit inspections
CREATE TABLE public.inspection_unit_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL,
  unit_id UUID,
  template_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.inspection_unit_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create inspection unit templates"
  ON public.inspection_unit_templates
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view all inspection unit templates"
  ON public.inspection_unit_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update inspection unit templates"
  ON public.inspection_unit_templates
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete inspection unit templates"
  ON public.inspection_unit_templates
  FOR DELETE
  USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_inspection_unit_templates_inspection_id 
  ON public.inspection_unit_templates(inspection_id);
CREATE INDEX idx_inspection_unit_templates_unit_id 
  ON public.inspection_unit_templates(unit_id);
CREATE INDEX idx_inspection_unit_templates_template_id 
  ON public.inspection_unit_templates(template_id);