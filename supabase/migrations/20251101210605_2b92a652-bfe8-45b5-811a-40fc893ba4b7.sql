-- Add applies_to_all_rooms column to default_room_tasks
ALTER TABLE public.default_room_tasks
ADD COLUMN applies_to_all_rooms BOOLEAN NOT NULL DEFAULT true;

-- Create junction table for default task to room template associations
CREATE TABLE public.default_task_room_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  default_task_id UUID NOT NULL REFERENCES public.default_room_tasks(id) ON DELETE CASCADE,
  room_template_id UUID NOT NULL REFERENCES public.room_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(default_task_id, room_template_id)
);

-- Enable RLS
ALTER TABLE public.default_task_room_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all default task room associations"
  ON public.default_task_room_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create default task room associations"
  ON public.default_task_room_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.default_room_tasks
      WHERE id = default_task_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their default task room associations"
  ON public.default_task_room_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.default_room_tasks
      WHERE id = default_task_id
      AND created_by = auth.uid()
    )
  );