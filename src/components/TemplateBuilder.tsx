import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Room {
  id: string;
  name: string;
  order_index: number;
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

export function TemplateBuilder({
  templateId,
  onClose,
}: {
  templateId: string;
  onClose: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(0);
  const [newItemType, setNewItemType] = useState<string>("");

  useEffect(() => {
    fetchRooms();
    fetchInventoryTypes();
  }, [templateId]);

  useEffect(() => {
    if (selectedRoom) {
      fetchItems(selectedRoom);
    }
  }, [selectedRoom]);

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

    setItems(data || []);
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

  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const { data, error } = await supabase
      .from("template_rooms")
      .insert({
        template_id: templateId,
        name: newRoomName,
        order_index: rooms.length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add room");
      return;
    }

    setRooms([...rooms, data]);
    setNewRoomName("");
    toast.success("Room added");
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

  const addItem = async () => {
    if (!selectedRoom || !newItemDescription.trim()) {
      toast.error("Please enter an item description");
      return;
    }

    const { data, error } = await supabase
      .from("template_items")
      .insert({
        room_id: selectedRoom,
        description: newItemDescription,
        inventory_quantity: newItemQuantity,
        inventory_type_id: newItemType || null,
        order_index: items.length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add item");
      return;
    }

    setItems([...items, data]);
    setNewItemDescription("");
    setNewItemQuantity(0);
    setNewItemType("");
    toast.success("Item added");
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("template_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to delete item");
      return;
    }

    setItems(items.filter((i) => i.id !== itemId));
    toast.success("Item deleted");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Template Builder</CardTitle>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rooms Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Rooms</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoom()}
              />
              <Button onClick={addRoom} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedRoom === room.id
                      ? "bg-accent border-primary"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span>{room.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(room.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Checklist Items {selectedRoom && `for ${rooms.find((r) => r.id === selectedRoom)?.name}`}
            </h3>

            {selectedRoom ? (
              <>
                <div className="space-y-3 border rounded-md p-3 bg-muted/50">
                  <div>
                    <Label>Item Description</Label>
                    <Input
                      placeholder="Item description..."
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Inventory Type</Label>
                      <Select value={newItemType} onValueChange={setNewItemType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={addItem} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3 border rounded-md"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.inventory_quantity}
                          {item.inventory_type_id && (
                            <> • Type: {inventoryTypes.find((t) => t.id === item.inventory_type_id)?.name}</>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Select or create a room to add items
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
