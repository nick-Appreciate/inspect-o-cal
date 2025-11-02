-- Create subtask activity table for tracking all changes
CREATE TABLE IF NOT EXISTS public.subtask_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('created', 'status_change', 'note_added', 'assigned', 'unassigned', 'completed', 'uncompleted')),
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_subtask_activity_subtask_id ON public.subtask_activity(subtask_id);
CREATE INDEX idx_subtask_activity_created_at ON public.subtask_activity(created_at DESC);

-- Enable RLS
ALTER TABLE public.subtask_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all subtask activity"
  ON public.subtask_activity
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create subtask activity"
  ON public.subtask_activity
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtask_activity;

-- Create function to log activity
CREATE OR REPLACE FUNCTION public.log_subtask_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.subtask_activity (subtask_id, activity_type, old_value, new_value, created_by)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, NEW.status_changed_by);
  END IF;

  -- Log completion changes
  IF TG_OP = 'UPDATE' AND OLD.completed IS DISTINCT FROM NEW.completed THEN
    IF NEW.completed = true THEN
      INSERT INTO public.subtask_activity (subtask_id, activity_type, created_by)
      VALUES (NEW.id, 'completed', NEW.completed_by);
    ELSE
      INSERT INTO public.subtask_activity (subtask_id, activity_type, created_by)
      VALUES (NEW.id, 'uncompleted', NEW.completed_by);
    END IF;
  END IF;

  -- Log note additions/changes
  IF TG_OP = 'UPDATE' AND OLD.attachment_url IS DISTINCT FROM NEW.attachment_url AND NEW.attachment_url IS NOT NULL THEN
    INSERT INTO public.subtask_activity (subtask_id, activity_type, notes, created_by)
    VALUES (NEW.id, 'note_added', NEW.attachment_url, NEW.status_changed_by);
  END IF;

  -- Log creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subtask_activity (subtask_id, activity_type, created_by)
    VALUES (NEW.id, 'created', NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER subtask_activity_trigger
  AFTER INSERT OR UPDATE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_subtask_activity();