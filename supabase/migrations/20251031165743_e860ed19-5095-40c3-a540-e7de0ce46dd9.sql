-- Change assigned_to to support multiple users
ALTER TABLE public.subtasks DROP COLUMN assigned_to;

-- Add assigned_users as an array of UUIDs
ALTER TABLE public.subtasks ADD COLUMN assigned_users UUID[] DEFAULT ARRAY[]::UUID[];