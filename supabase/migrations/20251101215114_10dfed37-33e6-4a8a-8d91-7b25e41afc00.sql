-- Enable realtime for template_properties and inspection_templates to keep templates UI in sync
ALTER PUBLICATION supabase_realtime ADD TABLE template_properties;
ALTER PUBLICATION supabase_realtime ADD TABLE inspection_templates;