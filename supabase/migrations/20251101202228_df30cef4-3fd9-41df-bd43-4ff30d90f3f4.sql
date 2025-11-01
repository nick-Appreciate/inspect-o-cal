-- Add trigger to handle new room template items being added
-- This will automatically add them to all template rooms using that room template
CREATE OR REPLACE FUNCTION add_new_room_template_items_to_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new room_template_item is inserted, add it to all template_rooms using this room_template
  INSERT INTO template_items (room_id, description, inventory_type_id, inventory_quantity, order_index, source_room_template_item_id)
  SELECT 
    tr.id as room_id,
    NEW.description,
    NEW.inventory_type_id,
    NEW.inventory_quantity,
    NEW.order_index,
    NEW.id as source_room_template_item_id
  FROM template_rooms tr
  WHERE tr.room_template_id = NEW.room_template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Create trigger for INSERT on room_template_items
DROP TRIGGER IF EXISTS add_room_template_items_trigger ON room_template_items;
CREATE TRIGGER add_room_template_items_trigger
AFTER INSERT ON room_template_items
FOR EACH ROW
EXECUTE FUNCTION add_new_room_template_items_to_templates();