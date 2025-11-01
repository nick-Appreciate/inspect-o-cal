-- Fix security warning: set search_path for the function
CREATE OR REPLACE FUNCTION sync_template_items_from_room_template()
RETURNS TRIGGER AS $$
BEGIN
  -- When a room_template_item is updated or deleted, update corresponding template_items
  IF TG_OP = 'UPDATE' THEN
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