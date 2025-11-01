-- Add source tracking to template_items to know which came from room templates
ALTER TABLE template_items 
ADD COLUMN source_room_template_item_id uuid REFERENCES room_template_items(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_template_items_source ON template_items(source_room_template_item_id);

-- Create function to sync template items when room template items change
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
$$ LANGUAGE plpgsql;

-- Create trigger on room_template_items
DROP TRIGGER IF EXISTS sync_template_items_trigger ON room_template_items;
CREATE TRIGGER sync_template_items_trigger
AFTER UPDATE OR DELETE ON room_template_items
FOR EACH ROW
EXECUTE FUNCTION sync_template_items_from_room_template();