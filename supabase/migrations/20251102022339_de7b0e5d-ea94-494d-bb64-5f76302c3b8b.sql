-- Drop triggers first, then functions (to handle dependencies correctly)

-- Drop triggers on room_template_items
DROP TRIGGER IF EXISTS sync_template_items_trigger ON room_template_items;
DROP TRIGGER IF EXISTS add_room_template_items_trigger ON room_template_items;

-- Drop trigger on template_rooms
DROP TRIGGER IF EXISTS populate_items_on_template_room_insert ON template_rooms;

-- Now drop the functions (no dependencies remain)
DROP FUNCTION IF EXISTS public.sync_template_items_from_room_template();
DROP FUNCTION IF EXISTS public.add_new_room_template_items_to_templates();
DROP FUNCTION IF EXISTS public.populate_template_items_on_room_insert();

-- This establishes a clean, manual-only copy path:
-- Room Template Items → (manual copy) → Template Items → (manual copy) → Inspection Subtasks