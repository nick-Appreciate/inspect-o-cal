-- Create vendor_types table
CREATE TABLE public.vendor_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all vendor types"
  ON public.vendor_types
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own vendor types"
  ON public.vendor_types
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own vendor types"
  ON public.vendor_types
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own vendor types"
  ON public.vendor_types
  FOR DELETE
  USING (auth.uid() = created_by);

-- Add vendor_type_id to room_template_items
ALTER TABLE public.room_template_items
ADD COLUMN vendor_type_id UUID REFERENCES public.vendor_types(id) ON DELETE SET NULL;

-- Add vendor_type_id to template_items
ALTER TABLE public.template_items
ADD COLUMN vendor_type_id UUID REFERENCES public.vendor_types(id) ON DELETE SET NULL;

-- Add vendor_type_id to subtasks
ALTER TABLE public.subtasks
ADD COLUMN vendor_type_id UUID REFERENCES public.vendor_types(id) ON DELETE SET NULL;