import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomTemplate {
  id: string;
  name: string;
  created_at: string;
}

interface RoomTemplateItem {
  id: string;
  room_template_id: string;
  description: string;
  order_index: number;
  inventory_type_id: string | null;
  inventory_quantity: number;
}

interface InventoryType {
  id: string;
  name: string;
}

interface ManageRoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageRoomsDialog({ open, onOpenChange }: ManageRoomsDialogProps) {
  const [rooms, setRooms] = useState<RoomTemplate[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [roomItems, setRoomItems] = useState<Record<string, RoomTemplateItem[]>>({});
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemInventoryType, setNewItemInventoryType] = useState<string>("");
  const [newItemQuantity, setNewItemQuantity] = useState<string>("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [newInventoryTypeName, setNewInventoryTypeName] = useState("");
  const [showAddInventoryType, setShowAddInventoryType] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRooms();
      fetchInventoryTypes();
    }
  }, [open]);

  useEffect(() => {
    if (expandedRoomId) {
      fetchRoomItems(expandedRoomId);
    }
  }, [expandedRoomId]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("room_templates" as any)
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load room templates");
      return;
    }

    setRooms(data as any || []);
  };

  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("room_templates" as any)
      .insert({
        name: newRoomName.trim(),
        created_by: user.id,
      });

    if (error) {
      toast.error("Failed to create room template");
      return;
    }

    setNewRoomName("");
    fetchRooms();
    toast.success("Room template created");
  };

  const deleteRoom = async () => {
    if (!deleteRoomId) return;

    const { error } = await supabase
      .from("room_templates" as any)
      .delete()
      .eq("id", deleteRoomId);

    if (error) {
      toast.error("Failed to delete room template");
      return;
    }

    setRooms(rooms.filter(r => r.id !== deleteRoomId));
    setDeleteRoomId(null);
    toast.success("Room template deleted");
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

  const fetchRoomItems = async (roomId: string) => {
    const { data, error } = await supabase
      .from("room_template_items" as any)
      .select("*")
      .eq("room_template_id", roomId)
      .order("order_index");

    if (error) {
      toast.error("Failed to load room items");
      return;
    }

    setRoomItems(prev => ({ ...prev, [roomId]: (data as any) || [] }));
  };

  const addRoomItem = async (roomId: string) => {
    if (!newItemDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    const items = roomItems[roomId] || [];
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;

    const { error } = await supabase
      .from("room_template_items" as any)
      .insert({
        room_template_id: roomId,
        description: newItemDescription.trim(),
        order_index: maxOrder + 1,
        inventory_type_id: newItemInventoryType || null,
        inventory_quantity: parseInt(newItemQuantity) || 0,
      });

    if (error) {
      toast.error("Failed to add task");
      return;
    }

    setNewItemDescription("");
    setNewItemInventoryType("");
    setNewItemQuantity("");
    fetchRoomItems(roomId);
    toast.success("Task added");
  };

  const deleteRoomItem = async () => {
    if (!deleteItemId) return;

    const { error } = await supabase
      .from("room_template_items" as any)
      .delete()
      .eq("id", deleteItemId);

    if (error) {
      toast.error("Failed to delete task");
      return;
    }

    // Update local state
    const updatedItems = { ...roomItems };
    Object.keys(updatedItems).forEach(roomId => {
      updatedItems[roomId] = updatedItems[roomId].filter(item => item.id !== deleteItemId);
    });
    setRoomItems(updatedItems);
    setDeleteItemId(null);
    toast.success("Task deleted");
  };

  const toggleRoomExpansion = (roomId: string) => {
    setExpandedRoomId(expandedRoomId === roomId ? null : roomId);
  };

  const addInventoryType = async () => {
    if (!newInventoryTypeName.trim()) {
      toast.error("Please enter an inventory type name");
      return;
    }

    // Check for duplicates
    const existingType = inventoryTypes.find(
      type => type.name.toLowerCase() === newInventoryTypeName.trim().toLowerCase()
    );
    if (existingType) {
      toast.error("An inventory type with this name already exists");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("inventory_types")
      .insert({
        name: newInventoryTypeName.trim(),
        created_by: user.id,
      });

    if (error) {
      toast.error("Failed to create inventory type");
      return;
    }

    setNewInventoryTypeName("");
    setShowAddInventoryType(false);
    fetchInventoryTypes();
    toast.success("Inventory type created");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Room Templates</DialogTitle>
            <DialogDescription>
              Create reusable room templates with tasks that can be added to any inspection template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create New Room Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="room-name">Room Name</Label>
                    <Input
                      id="room-name"
                      placeholder="e.g., Living Room, Kitchen, Bedroom"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addRoom();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={addRoom} className="mt-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Existing Room Templates ({rooms.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No room templates yet. Create your first one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rooms.map((room) => (
                      <div key={room.id} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => toggleRoomExpansion(room.id)}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${
                                expandedRoomId === room.id ? 'rotate-180' : ''
                              }`}
                            />
                            <span className="font-medium">{room.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {roomItems[room.id]?.length || 0} tasks
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteRoomId(room.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        {expandedRoomId === room.id && (
                          <div className="p-4 border-t bg-accent/20 space-y-3">
                            <div className="space-y-2">
                              <Label>Add Task</Label>
                              <Input
                                placeholder="Task description"
                                value={newItemDescription}
                                onChange={(e) => setNewItemDescription(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    addRoomItem(room.id);
                                  }
                                }}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Inventory Type (Optional)</Label>
                                  {showAddInventoryType ? (
                                    <div className="flex gap-1">
                                      <Input
                                        placeholder="New type name"
                                        value={newInventoryTypeName}
                                        onChange={(e) => setNewInventoryTypeName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            addInventoryType();
                                          } else if (e.key === "Escape") {
                                            setShowAddInventoryType(false);
                                            setNewInventoryTypeName("");
                                          }
                                        }}
                                        className="h-9"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        onClick={addInventoryType}
                                        className="h-9 px-2"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setShowAddInventoryType(false);
                                          setNewInventoryTypeName("");
                                        }}
                                        className="h-9 px-2"
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <select
                                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                        value={newItemInventoryType}
                                        onChange={(e) => setNewItemInventoryType(e.target.value)}
                                      >
                                        <option value="">None</option>
                                        {inventoryTypes.map((type) => (
                                          <option key={type.id} value={type.id}>
                                            {type.name}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowAddInventoryType(!showAddInventoryType)}
                                        className="h-9 px-2"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={newItemQuantity}
                                    onChange={(e) => setNewItemQuantity(e.target.value)}
                                    disabled={!newItemInventoryType}
                                  />
                                </div>
                              </div>
                              <Button onClick={() => addRoomItem(room.id)} size="sm" className="w-full">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Task
                              </Button>
                            </div>

                            {roomItems[room.id] && roomItems[room.id].length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-xs">Existing Tasks</Label>
                                {roomItems[room.id].map((item) => {
                                  const invType = inventoryTypes.find(t => t.id === item.inventory_type_id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                                    >
                                      <div className="flex-1">
                                        <div>{item.description}</div>
                                        {invType && (
                                          <div className="text-xs text-muted-foreground">
                                            {invType.name} × {item.inventory_quantity}
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setDeleteItemId(item.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRoomId} onOpenChange={() => setDeleteRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room template? This will not affect rooms already added to templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteRoomItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
