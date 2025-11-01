-- Add INSERT handler to sync new room template items to existing template rooms
CREATE OR REPLACE FUNCTION sync_template_items_from_room_template()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- When a new item is added to a room template, add it to all template_rooms using that template
    INSERT INTO template_items (room_id, description, inventory_type_id, inventory_quantity, order_index, source_room_template_item_id)
    SELECT 
      tr.id,
      NEW.description,
      NEW.inventory_type_id,
      NEW.inventory_quantity,
      NEW.order_index,
      NEW.id
    FROM template_rooms tr
    WHERE tr.room_template_id = NEW.room_template_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update all template_items that reference this room_template_item
    UPDATE template_items
    SET 
      description = NEW.description,
      inventory_type_id = NEW.inventory_type_id,
      inventory_quantity = NEW.inventory_quantity,
      order_index = NEW.order_index
    WHERE source_room_template_item_id = NEW.id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Delete all template_items that reference this room_template_item
    DELETE FROM template_items
    WHERE source_room_template_item_id = OLD.id;
    
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Update trigger to handle INSERT as well
DROP TRIGGER IF EXISTS sync_template_items_trigger ON room_template_items;
CREATE TRIGGER sync_template_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON room_template_items
FOR EACH ROW
EXECUTE FUNCTION sync_template_items_from_room_template();