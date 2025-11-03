-- Update status enum from good/bad to pass/fail
-- First, update existing data
UPDATE subtasks SET status = 'pass' WHERE status = 'good';
UPDATE subtasks SET status = 'fail' WHERE status = 'bad';

-- Drop the old constraint if it exists
ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;

-- Add new constraint with pass/fail
ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check 
  CHECK (status IN ('pass', 'fail', 'pending'));