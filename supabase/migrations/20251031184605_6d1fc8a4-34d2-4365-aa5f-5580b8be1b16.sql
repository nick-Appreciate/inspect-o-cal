-- Create inspection templates table
CREATE TABLE public.inspection_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create template rooms table
CREATE TABLE public.template_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.inspection_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory types table
CREATE TABLE public.inventory_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create template items table (checklist items with inventory)
CREATE TABLE public.template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.template_rooms(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  inventory_quantity INTEGER DEFAULT 0,
  inventory_type_id UUID REFERENCES public.inventory_types(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inspection_templates
CREATE POLICY "Users can view all templates"
  ON public.inspection_templates FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own templates"
  ON public.inspection_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own templates"
  ON public.inspection_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own templates"
  ON public.inspection_templates FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for template_rooms
CREATE POLICY "Users can view all rooms"
  ON public.template_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create rooms for their templates"
  ON public.template_rooms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspection_templates
      WHERE id = template_rooms.template_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update rooms for their templates"
  ON public.template_rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.inspection_templates
      WHERE id = template_rooms.template_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete rooms for their templates"
  ON public.template_rooms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.inspection_templates
      WHERE id = template_rooms.template_id
      AND created_by = auth.uid()
    )
  );

-- RLS Policies for inventory_types
CREATE POLICY "Users can view all inventory types"
  ON public.inventory_types FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own inventory types"
  ON public.inventory_types FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inventory types"
  ON public.inventory_types FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own inventory types"
  ON public.inventory_types FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for template_items
CREATE POLICY "Users can view all template items"
  ON public.template_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create items for their templates"
  ON public.template_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.template_rooms tr
      JOIN public.inspection_templates it ON it.id = tr.template_id
      WHERE tr.id = template_items.room_id
      AND it.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update items for their templates"
  ON public.template_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.template_rooms tr
      JOIN public.inspection_templates it ON it.id = tr.template_id
      WHERE tr.id = template_items.room_id
      AND it.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete items for their templates"
  ON public.template_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.template_rooms tr
      JOIN public.inspection_templates it ON it.id = tr.template_id
      WHERE tr.id = template_items.room_id
      AND it.created_by = auth.uid()
    )
  );