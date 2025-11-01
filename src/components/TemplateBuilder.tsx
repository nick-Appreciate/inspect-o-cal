import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Room {
  id: string;
  name: string;
  order_index: number;
  room_template_id?: string | null;
}

interface RoomTemplate {
  id: string;
  name: string;
}

interface Item {
  id: string;
  description: string;
  inventory_quantity: number;
  inventory_type_id: string | null;
  order_index: number;
}

interface InventoryType {
  id: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Floorplan {
  id: string;
  name: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  floorplan_id: string | null;
  floorplan?: { name: string } | null;
  template_properties?: { property_id: string }[];
}

export function TemplateBuilder({
  templateId,
  onClose,
}: {
  templateId: string;
  onClose: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTemplates, setRoomTemplates] = useState<RoomTemplate[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [itemsByRoom, setItemsByRoom] = useState<Record<string, Item[]>>({});
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [selectedRoomTemplate, setSelectedRoomTemplate] = useState("");
  const [newItemDescription, setNewItemDescription] = useState<Record<string, string>>({});
  const [newItemQuantity, setNewItemQuantity] = useState<Record<string, number>>({});
  const [newItemType, setNewItemType] = useState<Record<string, string>>({});
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [floorplans, setFloorplans] = useState<Floorplan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [showTemplateSettings, setShowTemplateSettings] = useState(true);

  useEffect(() => {
    fetchRooms();
    fetchRoomTemplates();
    fetchInventoryTypes();
    fetchTemplateInfo();
    fetchFloorplans();
    fetchProperties();
  }, [templateId]);

  useEffect(() => {
    rooms.forEach((room) => {
      fetchItems(room.id);
    });
  }, [rooms]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("template_rooms")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index");

    if (error) {
      toast.error("Failed to load rooms");
      return;
    }

    setRooms(data || []);
    if (data && data.length > 0 && !selectedRoom) {
      setSelectedRoom(data[0].id);
    }
  };

  const fetchItems = async (roomId: string) => {
    const { data, error } = await supabase
      .from("template_items")
      .select("*")
      .eq("room_id", roomId)
      .order("order_index");

    if (error) {
      toast.error("Failed to load items");
      return;
    }

    setItemsByRoom((prev) => ({ ...prev, [roomId]: data || [] }));
  };

  const fetchInventoryTypes = async () => {
    const { data, error } = await supabase
      .from("inventory_types")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load inventory types");
      return;
    }

    setInventoryTypes(data || []);
  };

  const fetchRoomTemplates = async () => {
    const { data, error } = await supabase
      .from("room_templates" as any)
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load room templates");
      return;
    }

    setRoomTemplates(data as any || []);
  };

  const fetchTemplateInfo = async () => {
    const { data, error } = await supabase
      .from("inspection_templates")
      .select(`
        id,
        name,
        floorplan_id,
        floorplan:floorplans(name),
        template_properties(property_id)
      `)
      .eq("id", templateId)
      .single();

    if (error) {
      toast.error("Failed to load template info");
      return;
    }

    setTemplateInfo(data);
    
    // Filter out any property IDs that don't exist anymore
    const validPropertyIds = data.template_properties
      ?.map(tp => tp.property_id)
      .filter(id => id != null) || [];
    
    setSelectedPropertyIds(validPropertyIds);
  };

  const fetchFloorplans = async () => {
    const { data, error } = await supabase
      .from("floorplans")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load floorplans");
      return;
    }

    setFloorplans(data || []);
  };

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load properties");
      return;
    }

    setProperties(data || []);
  };

  const updateFloorplan = async (floorplanId: string | null) => {
    const { error } = await supabase
      .from("inspection_templates")
      .update({ floorplan_id: floorplanId })
      .eq("id", templateId);

    if (error) {
      toast.error("Failed to update floorplan");
      return;
    }

    fetchTemplateInfo();
    toast.success("Floorplan updated");
  };

  const updateProperties = async (propertyIds: string[]) => {
    // Delete existing associations
    await supabase
      .from("template_properties")
      .delete()
      .eq("template_id", templateId);

    // Add new associations
    if (propertyIds.length > 0) {
      const associations = propertyIds.map(propertyId => ({
        template_id: templateId,
        property_id: propertyId,
      }));

      const { error } = await supabase
        .from("template_properties")
        .insert(associations);

      if (error) {
        toast.error("Failed to update properties");
        return;
      }
    }

    setSelectedPropertyIds(propertyIds);
    toast.success("Properties updated");
  };

  const addRoomFromTemplate = async () => {
    if (!selectedRoomTemplate) {
      toast.error("Please select a room template");
      return;
    }

    const roomTemplate = roomTemplates.find(rt => rt.id === selectedRoomTemplate);
    if (!roomTemplate) return;

    // Create the room
    const { data: newRoom, error: roomError } = await supabase
      .from("template_rooms")
      .insert({
        template_id: templateId,
        name: roomTemplate.name,
        room_template_id: selectedRoomTemplate,
        order_index: rooms.length,
      })
      .select()
      .single();

    if (roomError) {
      console.error("Failed to add room:", roomError);
      toast.error(roomError.message || "Failed to add room");
      return;
    }

    // Fetch tasks from the room template
    const { data: templateItems, error: itemsError } = await supabase
      .from("room_template_items" as any)
      .select("*")
      .eq("room_template_id", selectedRoomTemplate)
      .order("order_index");

    if (itemsError) {
      console.error("Failed to fetch template items:", itemsError);
      toast.error("Room added but failed to copy tasks");
      setRooms([...rooms, newRoom]);
      setSelectedRoomTemplate("");
      return;
    }

    // Copy tasks to the new room if any exist
    if (templateItems && templateItems.length > 0) {
      const itemsToInsert = templateItems.map((item: any) => ({
        room_id: newRoom.id,
        description: item.description,
        order_index: item.order_index,
        inventory_type_id: item.inventory_type_id,
        inventory_quantity: item.inventory_quantity,
      }));

      const { error: insertItemsError } = await supabase
        .from("template_items")
        .insert(itemsToInsert);

      if (insertItemsError) {
        console.error("Failed to copy template items:", insertItemsError);
        toast.error("Room added but failed to copy some tasks");
      }

      // Fetch the newly added items to update the UI
      await fetchItems(newRoom.id);
    }

    setRooms([...rooms, newRoom]);
    setSelectedRoomTemplate("");
    toast.success(`Room added with ${templateItems?.length || 0} tasks`);
  };

  const deleteRoom = async (roomId: string) => {
    const { error } = await supabase
      .from("template_rooms")
      .delete()
      .eq("id", roomId);

    if (error) {
      toast.error("Failed to delete room");
      return;
    }

    setRooms(rooms.filter((r) => r.id !== roomId));
    if (selectedRoom === roomId) {
      setSelectedRoom(rooms[0]?.id || null);
    }
    toast.success("Room deleted");
  };

  const addItem = async (roomId: string) => {
    const description = newItemDescription[roomId];
    if (!description?.trim()) {
      toast.error("Please enter a task");
      return;
    }

    const quantity = newItemQuantity[roomId] || 0;
    const typeId = newItemType[roomId];

    const { data, error } = await supabase
      .from("template_items")
      .insert({
        room_id: roomId,
        description: description.trim(),
        inventory_quantity: quantity > 0 ? quantity : null,
        inventory_type_id: typeId && typeId !== "" ? typeId : null,
        order_index: (itemsByRoom[roomId] || []).length,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to add template item:", error);
      toast.error(error.message || "Failed to add item");
      return;
    }

    setItemsByRoom((prev) => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), data],
    }));
    setNewItemDescription((prev) => ({ ...prev, [roomId]: "" }));
    setNewItemQuantity((prev) => ({ ...prev, [roomId]: 0 }));
    setNewItemType((prev) => ({ ...prev, [roomId]: "" }));
    toast.success("Item added");
  };

  const deleteItem = async (itemId: string, roomId: string) => {
    const { error } = await supabase
      .from("template_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to delete item");
      return;
    }

    setItemsByRoom((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] || []).filter((i) => i.id !== itemId),
    }));
    toast.success("Item deleted");
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = rooms.findIndex((room) => room.id === active.id);
    const newIndex = rooms.findIndex((room) => room.id === over.id);

    const newRooms = arrayMove(rooms, oldIndex, newIndex);
    setRooms(newRooms);

    // Update order_index for all rooms
    const updates = newRooms.map((room, index) => ({
      id: room.id,
      order_index: index,
    }));

    for (const update of updates) {
      await supabase
        .from("template_rooms")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
    }

    toast.success("Room order updated");
  };

  interface SortableRoomItemProps {
    room: Room;
    items: Item[];
    inventoryTypes: InventoryType[];
    newItemDescription: string;
    newItemQuantity: number;
    newItemType: string;
    onDescriptionChange: (value: string) => void;
    onQuantityChange: (value: number) => void;
    onTypeChange: (value: string) => void;
    onAddItem: () => void;
    onDeleteRoom: () => void;
    onDeleteItem: (itemId: string) => void;
  }

  function SortableRoomItem({
    room,
    items,
    inventoryTypes,
    newItemDescription,
    newItemQuantity,
    newItemType,
    onDescriptionChange,
    onQuantityChange,
    onTypeChange,
    onAddItem,
    onDeleteRoom,
    onDeleteItem,
  }: SortableRoomItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: room.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="space-y-4">
        {/* Room Header */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">{room.name}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteRoom}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Add Item Form for this Room */}
        <div className="ml-6 space-y-3 border rounded-md p-4 bg-background">
          <div>
            <Label>Task</Label>
            <Input
              placeholder="Task..."
              value={newItemDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0"
                max="99999"
                value={newItemQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onQuantityChange(isNaN(val) || val < 0 ? 0 : Math.min(val, 99999));
                }}
              />
            </div>
            <div>
              <Label>Inventory Type</Label>
              <Select
                value={newItemType}
                onValueChange={onTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                  <div className="p-2 border-t">
                    <Input
                      placeholder="Create new type..."
                      maxLength={100}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const input = e.currentTarget;
                          const newTypeName = input.value.trim();
                          if (!newTypeName) return;
                          
                          if (newTypeName.length > 100) {
                            toast.error("Inventory type name must be less than 100 characters");
                            return;
                          }

                          const { data: user } = await supabase.auth.getUser();
                          if (!user.user) {
                            toast.error("Please sign in to create inventory types");
                            return;
                          }

                          const { data, error } = await supabase
                            .from("inventory_types")
                            .insert({
                              name: newTypeName,
                              created_by: user.user.id,
                            })
                            .select()
                            .single();

                          if (error) {
                            console.error("Failed to create inventory type:", error);
                            toast.error(error.message || "Failed to create inventory type");
                            return;
                          }

                          input.value = "";
                          toast.success("Inventory type created");
                          // Note: Parent component needs to refresh inventory types
                        }
                      }}
                    />
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={onAddItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Item to {room.name}
          </Button>
        </div>

        {/* Items List for this Room */}
        <div className="ml-6 space-y-2">
          {items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-3 border rounded-md bg-background"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  {item.inventory_quantity > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.inventory_quantity}
                      {item.inventory_type_id && (
                        <>
                          {" "}
                          • Type:{" "}
                          {inventoryTypes.find((t) => t.id === item.inventory_type_id)?.name}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items yet. Add items using the form above.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col max-h-[85vh]">
      <CardHeader className="flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle>Template Builder</CardTitle>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 overflow-y-auto flex-1">
        {/* Template Settings */}
        {templateInfo && (
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setShowTemplateSettings(!showTemplateSettings)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Template Settings</CardTitle>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${
                    showTemplateSettings ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </CardHeader>
            {showTemplateSettings && (
              <CardContent className="space-y-4">
                <div>
                  <Label>Floorplan</Label>
                  <Select
                    value={templateInfo.floorplan_id || "none"}
                    onValueChange={(value) => updateFloorplan(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select floorplan" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="none">No Floorplan</SelectItem>
                      {floorplans.map((floorplan) => (
                        <SelectItem key={floorplan.id} value={floorplan.id}>
                          {floorplan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Associated Properties</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {properties.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No properties available</p>
                    ) : (
                      properties.map((property) => (
                        <div key={property.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`prop-${property.id}`}
                            checked={selectedPropertyIds.includes(property.id)}
                            onChange={(e) => {
                              const newIds = e.target.checked
                                ? [...selectedPropertyIds, property.id]
                                : selectedPropertyIds.filter(id => id !== property.id);
                              updateProperties(newIds);
                            }}
                            className="rounded border-input"
                          />
                          <label
                            htmlFor={`prop-${property.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {property.name} - {property.address}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Add Room from Template */}
        <div className="space-y-2">
          <Label>Add Room from Template</Label>
          <div className="flex gap-2">
            <Select value={selectedRoomTemplate} onValueChange={setSelectedRoomTemplate}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a room template" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {roomTemplates.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No room templates available. Create one in Manage Rooms.
                  </div>
                ) : (
                  roomTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button onClick={addRoomFromTemplate} size="icon" disabled={!selectedRoomTemplate}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only room templates created in "Manage Rooms" can be selected here
          </p>
        </div>

        {/* Rooms with Items */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rooms.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {rooms.map((room) => (
                <SortableRoomItem
                  key={room.id}
                  room={room}
                  items={itemsByRoom[room.id] || []}
                  inventoryTypes={inventoryTypes}
                  newItemDescription={newItemDescription[room.id] || ""}
                  newItemQuantity={newItemQuantity[room.id] || 0}
                  newItemType={newItemType[room.id] || ""}
                  onDescriptionChange={(value) =>
                    setNewItemDescription((prev) => ({ ...prev, [room.id]: value }))
                  }
                  onQuantityChange={(value) =>
                    setNewItemQuantity((prev) => ({ ...prev, [room.id]: value }))
                  }
                  onTypeChange={(value) =>
                    setNewItemType((prev) => ({ ...prev, [room.id]: value }))
                  }
                  onAddItem={() => addItem(room.id)}
                  onDeleteRoom={() => deleteRoom(room.id)}
                  onDeleteItem={(itemId) => deleteItem(itemId, room.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {rooms.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Create a room to get started
          </p>
        )}
      </CardContent>
    </Card>
  );
}
