-- Add completion tracking fields to subtasks table
ALTER TABLE public.subtasks 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completed_by UUID REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX idx_subtasks_completed_by ON public.subtasks(completed_by);
CREATE INDEX idx_subtasks_completed_at ON public.subtasks(completed_at);

COMMENT ON COLUMN public.subtasks.completed_at IS 'Timestamp when the subtask was marked as completed';
COMMENT ON COLUMN public.subtasks.completed_by IS 'User who marked the subtask as completed';