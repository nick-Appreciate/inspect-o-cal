-- Add inventory fields to subtasks table
ALTER TABLE public.subtasks
ADD COLUMN inventory_quantity INTEGER DEFAULT 0,
ADD COLUMN inventory_type_id UUID REFERENCES public.inventory_types(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_subtasks_inventory_type ON public.subtasks(inventory_type_id);