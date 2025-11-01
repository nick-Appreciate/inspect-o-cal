-- Add status field to subtasks to track good/bad/pending like inspection items
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('good', 'bad', 'pending'));

-- Add inspection_template_id to inspections to track which template was used
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_template_id UUID REFERENCES inspection_templates(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_inspections_template ON inspections(inspection_template_id);