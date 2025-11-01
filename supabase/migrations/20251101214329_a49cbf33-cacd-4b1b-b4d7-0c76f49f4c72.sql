
-- Enable realtime for room template related tables
ALTER PUBLICATION supabase_realtime ADD TABLE room_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE default_room_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE default_task_room_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE room_template_items;
