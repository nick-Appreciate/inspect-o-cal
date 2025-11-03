-- Ensure only a single logging trigger exists on subtasks and remove duplicates across all activity types
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT trigger_name FROM information_schema.triggers WHERE event_object_table='subtasks'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.subtasks;', r.trigger_name);
  END LOOP;
END $$;

CREATE TRIGGER log_subtask_activity_trigger
  AFTER INSERT OR UPDATE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_subtask_activity();

-- Remove duplicate activity rows keeping the earliest per unique signature
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY subtask_id, activity_type, coalesce(notes,'__'), coalesce(old_value,'__'), coalesce(new_value,'__'), created_by
           ORDER BY created_at ASC
         ) AS rn
  FROM public.subtask_activity
)
DELETE FROM public.subtask_activity sa
USING ranked r
WHERE sa.id = r.id AND r.rn > 1;