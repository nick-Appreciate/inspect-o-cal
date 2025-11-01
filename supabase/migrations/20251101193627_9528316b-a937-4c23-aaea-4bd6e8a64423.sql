-- Create room_templates table for reusable room templates
CREATE TABLE public.room_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_templates
CREATE POLICY "Users can view all room templates"
ON public.room_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own room templates"
ON public.room_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own room templates"
ON public.room_templates FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own room templates"
ON public.room_templates FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Add room_template_id to template_rooms to link to reusable templates
ALTER TABLE public.template_rooms
ADD COLUMN room_template_id UUID REFERENCES public.room_templates(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_template_rooms_room_template_id ON public.template_rooms(room_template_id);