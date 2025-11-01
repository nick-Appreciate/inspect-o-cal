-- Add vendor_type_id to default_room_tasks table
ALTER TABLE public.default_room_tasks
ADD COLUMN vendor_type_id UUID REFERENCES public.vendor_types(id) ON DELETE SET NULL;