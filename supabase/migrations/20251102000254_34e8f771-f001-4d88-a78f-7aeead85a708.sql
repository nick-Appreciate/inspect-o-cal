-- Add tracking columns for subtask status changes
ALTER TABLE subtasks
ADD COLUMN status_changed_by uuid REFERENCES auth.users(id),
ADD COLUMN status_changed_at timestamp with time zone;

-- Create index for better query performance
CREATE INDEX idx_subtasks_status_changed_at ON subtasks(status_changed_at);
CREATE INDEX idx_subtasks_status_changed_by ON subtasks(status_changed_by);