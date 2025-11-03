-- First, let's see what triggers exist
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'subtasks'::regclass 
        AND tgname LIKE '%log_subtask%'
    LOOP
        RAISE NOTICE 'Found trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- Drop all existing triggers related to log_subtask_activity
DROP TRIGGER IF EXISTS log_subtask_activity_trigger ON subtasks;
DROP TRIGGER IF EXISTS log_subtask_activity ON subtasks;

-- Recreate the trigger (only once, AFTER operation)
CREATE TRIGGER log_subtask_activity_trigger
  AFTER INSERT OR UPDATE ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION log_subtask_activity();

-- Clean up duplicate "created" entries (keep only the oldest one for each subtask)
DELETE FROM subtask_activity
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY subtask_id, activity_type ORDER BY created_at ASC) as rn
    FROM subtask_activity
    WHERE activity_type = 'created'
  ) t
  WHERE t.rn > 1
);