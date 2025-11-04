-- Enable realtime for subtasks table
ALTER TABLE public.subtasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;