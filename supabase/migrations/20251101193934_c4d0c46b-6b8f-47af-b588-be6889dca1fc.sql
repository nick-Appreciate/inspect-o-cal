-- Create table for room template items/tasks
CREATE TABLE public.room_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_template_id UUID NOT NULL REFERENCES public.room_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  inventory_type_id UUID REFERENCES public.inventory_types(id) ON DELETE SET NULL,
  inventory_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_template_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all room template items"
ON public.room_template_items
FOR SELECT
USING (true);

CREATE POLICY "Users can create items for their room templates"
ON public.room_template_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.room_templates
    WHERE room_templates.id = room_template_items.room_template_id
    AND room_templates.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update items for their room templates"
ON public.room_template_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.room_templates
    WHERE room_templates.id = room_template_items.room_template_id
    AND room_templates.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete items for their room templates"
ON public.room_template_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.room_templates
    WHERE room_templates.id = room_template_items.room_template_id
    AND room_templates.created_by = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_room_template_items_room_template_id ON public.room_template_items(room_template_id);