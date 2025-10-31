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
  const [itemsByRoom, setItemsByRoom] = useState<Record<string, Item[]>>({});
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState<Record<string, string>>({});
  const [newItemQuantity, setNewItemQuantity] = useState<Record<string, number>>({});
  const [newItemType, setNewItemType] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRooms();
    fetchInventoryTypes();
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

  const addItem = async (roomId: string) => {
    const description = newItemDescription[roomId];
    if (!description?.trim()) {
      toast.error("Please enter an item description");
      return;
    }

    const { data, error } = await supabase
      .from("template_items")
      .insert({
        room_id: roomId,
        description: description,
        inventory_quantity: newItemQuantity[roomId] || 0,
        inventory_type_id: newItemType[roomId] || null,
        order_index: (itemsByRoom[roomId] || []).length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add item");
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
      <CardContent className="space-y-6">
        {/* Add New Room */}
        <div className="space-y-2">
          <Label>Add New Room</Label>
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
        </div>

        {/* Rooms with Items */}
        <div className="space-y-6">
          {rooms.map((room) => (
            <div key={room.id} className="space-y-4">
              {/* Room Header */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{room.name}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRoom(room.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Add Item Form for this Room */}
              <div className="ml-6 space-y-3 border rounded-md p-4 bg-background">
                <div>
                  <Label>Item Description</Label>
                  <Input
                    placeholder="Item description..."
                    value={newItemDescription[room.id] || ""}
                    onChange={(e) =>
                      setNewItemDescription((prev) => ({ ...prev, [room.id]: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newItemQuantity[room.id] || 0}
                      onChange={(e) =>
                        setNewItemQuantity((prev) => ({
                          ...prev,
                          [room.id]: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Inventory Type</Label>
                    <Select
                      value={newItemType[room.id] || ""}
                      onValueChange={(value) =>
                        setNewItemType((prev) => ({ ...prev, [room.id]: value }))
                      }
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={() => addItem(room.id)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item to {room.name}
                </Button>
              </div>

              {/* Items List for this Room */}
              <div className="ml-6 space-y-2">
                {(itemsByRoom[room.id] || []).length > 0 ? (
                  (itemsByRoom[room.id] || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3 border rounded-md bg-background"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
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
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item.id, room.id)}
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
          ))}

          {rooms.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Create a room to get started
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
