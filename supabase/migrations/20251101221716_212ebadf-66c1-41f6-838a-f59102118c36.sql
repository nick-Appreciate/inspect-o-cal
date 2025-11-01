-- Add room_name column to subtasks table for grouping tasks by room
ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS room_name TEXT;