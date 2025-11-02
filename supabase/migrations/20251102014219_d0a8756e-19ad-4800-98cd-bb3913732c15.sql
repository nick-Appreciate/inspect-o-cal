-- Populate missing template_items for template_rooms that have room_template_id but no items
INSERT INTO template_items (room_id, description, inventory_type_id, inventory_quantity, order_index, source_room_template_item_id, vendor_type_id)
SELECT 
  tr.id as room_id,
  rti.description,
  rti.inventory_type_id,
  rti.inventory_quantity,
  rti.order_index,
  rti.id as source_room_template_item_id,
  rti.vendor_type_id
FROM template_rooms tr
JOIN room_template_items rti ON tr.room_template_id = rti.room_template_id
WHERE tr.room_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM template_items ti 
    WHERE ti.room_id = tr.id 
    AND ti.source_room_template_item_id = rti.id
  )
ORDER BY tr.id, rti.order_index;