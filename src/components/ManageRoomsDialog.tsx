import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface RoomTemplate {
  id: string;
  name: string;
  created_at: string;
}

interface RoomTemplateItem {
  id: string;
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
  const [newItemQuantity, setNewItemQuantity] = useState(0);

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

    setRoomItems(prev => ({ ...prev, [roomId]: data as any || [] }));
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

  const addItemToRoom = async (roomId: string) => {
    if (!newItemDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const items = roomItems[roomId] || [];
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;

    const { error } = await supabase
      .from("room_template_items" as any)
      .insert({
        room_template_id: roomId,
        description: newItemDescription.trim(),
        order_index: maxOrder + 1,
        inventory_type_id: newItemInventoryType || null,
        inventory_quantity: newItemQuantity,
      });

    if (error) {
      toast.error("Failed to add task");
      return;
    }

    setNewItemDescription("");
    setNewItemInventoryType("");
    setNewItemQuantity(0);
    fetchRoomItems(roomId);
    toast.success("Task added");
  };

  const deleteItem = async (roomId: string, itemId: string) => {
    const { error } = await supabase
      .from("room_template_items" as any)
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to delete task");
      return;
    }

    fetchRoomItems(roomId);
    toast.success("Task deleted");
  };

  const toggleRoomExpansion = (roomId: string) => {
    setExpandedRoomId(expandedRoomId === roomId ? null : roomId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Room Templates</DialogTitle>
            <DialogDescription>
              Create reusable room templates that can be added to any inspection template
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
                    {rooms.map((room) => {
                      const isExpanded = expandedRoomId === room.id;
                      const items = roomItems[room.id] || [];
                      
                      return (
                        <div
                          key={room.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 flex-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRoomExpansion(room.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <span className="font-medium">{room.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({items.length} {items.length === 1 ? 'task' : 'tasks'})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteRoomId(room.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          {isExpanded && (
                            <div className="p-4 bg-accent/20 space-y-3">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Add Task</Label>
                                <Textarea
                                  placeholder="Task description"
                                  value={newItemDescription}
                                  onChange={(e) => setNewItemDescription(e.target.value)}
                                  className="min-h-[60px]"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Inventory Type (optional)</Label>
                                    <Select
                                      value={newItemInventoryType}
                                      onValueChange={setNewItemInventoryType}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="None" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="">None</SelectItem>
                                        {inventoryTypes.map((type) => (
                                          <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Quantity</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={newItemQuantity}
                                      onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
                                      disabled={!newItemInventoryType}
                                    />
                                  </div>
                                </div>
                                <Button
                                  onClick={() => addItemToRoom(room.id)}
                                  size="sm"
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Task
                                </Button>
                              </div>

                              {items.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Tasks</Label>
                                  {items.map((item) => {
                                    const invType = inventoryTypes.find(t => t.id === item.inventory_type_id);
                                    return (
                                      <div
                                        key={item.id}
                                        className="flex items-start justify-between p-2 bg-background rounded border"
                                      >
                                        <div className="flex-1">
                                          <p className="text-sm">{item.description}</p>
                                          {invType && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {invType.name} × {item.inventory_quantity}
                                            </p>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => deleteItem(room.id, item.id)}
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
                      );
                    })}
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
    </>
  );
}
