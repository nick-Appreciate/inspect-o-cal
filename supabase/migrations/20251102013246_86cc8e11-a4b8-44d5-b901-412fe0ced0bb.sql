-- Ensure subtask activity is logged on create and updates
DROP TRIGGER IF EXISTS log_subtask_activity_trigger ON public.subtasks;
CREATE TRIGGER log_subtask_activity_trigger
AFTER INSERT OR UPDATE ON public.subtasks
FOR EACH ROW
EXECUTE FUNCTION public.log_subtask_activity();