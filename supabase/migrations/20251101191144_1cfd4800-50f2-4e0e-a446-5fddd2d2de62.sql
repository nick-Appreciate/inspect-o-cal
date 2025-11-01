-- Delete all existing inspection templates and related data
DELETE FROM template_items;
DELETE FROM template_rooms;
DELETE FROM inspection_templates;

-- Create floorplans table for managing floorplan types
CREATE TABLE public.floorplans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on floorplans
ALTER TABLE public.floorplans ENABLE ROW LEVEL SECURITY;

-- RLS policies for floorplans
CREATE POLICY "Users can view all floorplans"
ON public.floorplans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own floorplans"
ON public.floorplans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own floorplans"
ON public.floorplans FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own floorplans"
ON public.floorplans FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Add floorplan_id to units table
ALTER TABLE public.units
ADD COLUMN floorplan_id UUID REFERENCES public.floorplans(id) ON DELETE SET NULL;

-- Update inspection_templates table
ALTER TABLE public.inspection_templates
DROP COLUMN IF EXISTS type;

ALTER TABLE public.inspection_templates
ADD COLUMN floorplan_id UUID REFERENCES public.floorplans(id) ON DELETE CASCADE;

-- Create junction table for template-property associations
CREATE TABLE public.template_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.inspection_templates(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, property_id)
);

-- Enable RLS on template_properties
ALTER TABLE public.template_properties ENABLE ROW LEVEL SECURITY;

-- RLS policies for template_properties
CREATE POLICY "Users can view all template properties"
ON public.template_properties FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create template properties for their templates"
ON public.template_properties FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM inspection_templates
    WHERE inspection_templates.id = template_properties.template_id
    AND inspection_templates.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete template properties for their templates"
ON public.template_properties FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM inspection_templates
    WHERE inspection_templates.id = template_properties.template_id
    AND inspection_templates.created_by = auth.uid()
  )
);

-- Add index for better query performance
CREATE INDEX idx_units_floorplan_id ON public.units(floorplan_id);
CREATE INDEX idx_inspection_templates_floorplan_id ON public.inspection_templates(floorplan_id);
CREATE INDEX idx_template_properties_template_id ON public.template_properties(template_id);
CREATE INDEX idx_template_properties_property_id ON public.template_properties(property_id);