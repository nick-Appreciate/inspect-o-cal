import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, Copy, Lock, ArrowRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  vendor_type_id: string | null;
}

interface InventoryType {
  id: string;
  name: string;
}

interface VendorType {
  id: string;
  name: string;
  default_assigned_user_id: string | null;
}

interface DefaultTask {
  id: string;
  description: string;
  inventory_type_id: string | null;
  inventory_quantity: number;
  vendor_type_id: string | null;
  applies_to_all_rooms: boolean;
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
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>([]);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemInventoryType, setNewItemInventoryType] = useState<string>("");
  const [newItemQuantity, setNewItemQuantity] = useState<string>("");
  const [newItemVendorType, setNewItemVendorType] = useState<string>("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [newInventoryTypeName, setNewInventoryTypeName] = useState("");
  const [showAddInventoryType, setShowAddInventoryType] = useState(false);
  const [selectedDuplicateRoomId, setSelectedDuplicateRoomId] = useState<string>("");
  const [defaultTasks, setDefaultTasks] = useState<DefaultTask[]>([]);
  const [defaultTaskDescription, setDefaultTaskDescription] = useState("");
  const [defaultTaskInventoryType, setDefaultTaskInventoryType] = useState<string>("");
  const [defaultTaskQuantity, setDefaultTaskQuantity] = useState<string>("");
  const [defaultTaskVendorType, setDefaultTaskVendorType] = useState<string>("");
  const [defaultTaskRooms, setDefaultTaskRooms] = useState<string[]>([]);
  const [defaultTaskAppliesToAll, setDefaultTaskAppliesToAll] = useState(true);
  const [defaultTaskRoomAssociations, setDefaultTaskRoomAssociations] = useState<Record<string, string[]>>({});
  const [deleteDefaultTaskId, setDeleteDefaultTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchRooms();
      fetchInventoryTypes();
      fetchVendorTypes();
      fetchDefaultTasks();
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

  const fetchDefaultTasks = async () => {
    const { data, error } = await supabase
      .from("default_room_tasks" as any)
      .select("*")
      .order("created_at");

    if (error) {
      toast.error("Failed to load default tasks");
      return;
    }

    setDefaultTasks(data as any || []);
    
    // Fetch room associations for tasks that don't apply to all
    const tasksNotApplyingToAll = (data as any[])?.filter(t => !t.applies_to_all_rooms) || [];
    
    if (tasksNotApplyingToAll.length > 0) {
      const { data: associations } = await supabase
        .from("default_task_room_templates" as any)
        .select("default_task_id, room_template_id")
        .in("default_task_id", tasksNotApplyingToAll.map(t => t.id));
      
      if (associations) {
        const assocMap = (associations as any[]).reduce((acc: Record<string, string[]>, assoc: any) => {
          if (!acc[assoc.default_task_id]) acc[assoc.default_task_id] = [];
          acc[assoc.default_task_id].push(assoc.room_template_id);
          return acc;
        }, {} as Record<string, string[]>);
        
        setDefaultTaskRoomAssociations(assocMap);
      }
    } else {
      setDefaultTaskRoomAssociations({});
    }
  };

  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newRoom, error } = await supabase
      .from("room_templates" as any)
      .insert({
        name: newRoomName.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !newRoom) {
      toast.error("Failed to create room template");
      return;
    }

    const itemsToInsert: any[] = [];

    // Add default tasks to the new room (only those that apply to all or are specifically associated)
    if (defaultTasks.length > 0) {
      // Fetch room associations for tasks that don't apply to all
      const tasksNotApplyingToAll = defaultTasks.filter(t => !t.applies_to_all_rooms);
      let taskRoomAssociations: Record<string, string[]> = {};
      
      if (tasksNotApplyingToAll.length > 0) {
        const { data: associations } = await supabase
          .from("default_task_room_templates" as any)
          .select("default_task_id, room_template_id")
          .in("default_task_id", tasksNotApplyingToAll.map(t => t.id));
        
        if (associations) {
          taskRoomAssociations = (associations as any[]).reduce((acc: Record<string, string[]>, assoc: any) => {
            if (!acc[assoc.default_task_id]) acc[assoc.default_task_id] = [];
            acc[assoc.default_task_id].push(assoc.room_template_id);
            return acc;
          }, {} as Record<string, string[]>);
        }
      }
      
      defaultTasks.forEach((task, index) => {
        // Add task if it applies to all rooms OR if this room is in its associations
        const shouldAdd = task.applies_to_all_rooms || 
          (taskRoomAssociations[task.id]?.includes((newRoom as any).id));
        
        if (shouldAdd) {
          itemsToInsert.push({
            room_template_id: (newRoom as any).id,
            description: task.description,
            order_index: index,
            inventory_type_id: task.inventory_type_id,
            inventory_quantity: task.inventory_quantity,
            vendor_type_id: task.vendor_type_id,
          });
        }
      });
    }

    // If duplicating from another room, add its items after default tasks
    if (selectedDuplicateRoomId) {
      const { data: items, error: itemsError } = await supabase
        .from("room_template_items" as any)
        .select("*")
        .eq("room_template_id", selectedDuplicateRoomId)
        .order("order_index");

      if (!itemsError && items && items.length > 0) {
        items.forEach((item: any, index: number) => {
          itemsToInsert.push({
            room_template_id: (newRoom as any).id,
            description: item.description,
            order_index: defaultTasks.length + index,
            inventory_type_id: item.inventory_type_id,
            inventory_quantity: item.inventory_quantity,
            vendor_type_id: item.vendor_type_id,
          });
        });
      }
    }

    // Insert all items
    if (itemsToInsert.length > 0) {
      await supabase.from("room_template_items" as any).insert(itemsToInsert);
      toast.success(`Room template created with ${itemsToInsert.length} task${itemsToInsert.length > 1 ? 's' : ''}`);
    } else {
      toast.success("Room template created");
    }

    setNewRoomName("");
    setSelectedDuplicateRoomId("");
    fetchRooms();
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

  const fetchVendorTypes = async () => {
    const { data, error } = await supabase
      .from("vendor_types")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load vendor types");
      return;
    }

    setVendorTypes(data || []);
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
        vendor_type_id: newItemVendorType || null,
      });

    if (error) {
      toast.error("Failed to add task");
      return;
    }

    setNewItemDescription("");
    setNewItemInventoryType("");
    setNewItemQuantity("");
    setNewItemVendorType("");
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

  const addDefaultTask = async () => {
    if (!defaultTaskDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Insert into default_room_tasks
    const { data: newDefaultTask, error: defaultError } = await supabase
      .from("default_room_tasks" as any)
      .insert({
        description: defaultTaskDescription.trim(),
        inventory_type_id: defaultTaskInventoryType || null,
        inventory_quantity: parseInt(defaultTaskQuantity) || 0,
        vendor_type_id: defaultTaskVendorType || null,
        applies_to_all_rooms: defaultTaskAppliesToAll,
        created_by: user.id,
      })
      .select()
      .single();

    if (defaultError || !newDefaultTask) {
      toast.error("Failed to add default task");
      return;
    }

    // If not applying to all rooms, create associations
    if (!defaultTaskAppliesToAll && defaultTaskRooms.length > 0) {
      const associations = defaultTaskRooms.map(roomId => ({
        default_task_id: (newDefaultTask as any).id,
        room_template_id: roomId,
      }));

      await supabase
        .from("default_task_room_templates" as any)
        .insert(associations);
    }

    // Add this task to existing room templates (only those selected or if applies to all)
    if (rooms.length > 0) {
      const roomsToAddTo = defaultTaskAppliesToAll ? rooms : rooms.filter(r => defaultTaskRooms.includes(r.id));
      
      if (roomsToAddTo.length > 0) {
        const itemsToInsert = [];
        for (const room of roomsToAddTo) {
          const items = roomItems[room.id] || [];
          const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;
          
          itemsToInsert.push({
            room_template_id: room.id,
            description: defaultTaskDescription.trim(),
            order_index: maxOrder + 1,
            inventory_type_id: defaultTaskInventoryType || null,
            inventory_quantity: parseInt(defaultTaskQuantity) || 0,
            vendor_type_id: defaultTaskVendorType || null,
          });
        }

        const { error: insertError } = await supabase
          .from("room_template_items" as any)
          .insert(itemsToInsert);

        if (insertError) {
          toast.error("Default task created but failed to add to existing rooms");
        } else {
          // Refresh items for affected rooms
          roomsToAddTo.forEach(room => fetchRoomItems(room.id));
          toast.success(`Default task added to ${roomsToAddTo.length} room template${roomsToAddTo.length > 1 ? 's' : ''}`);
        }
      } else {
        toast.success("Default task created (will be added to selected rooms)");
      }
    } else {
      toast.success("Default task created (will be added to future rooms)");
    }

    // Clear form and refresh
    setDefaultTaskDescription("");
    setDefaultTaskInventoryType("");
    setDefaultTaskQuantity("");
    setDefaultTaskVendorType("");
    setDefaultTaskRooms([]);
    setDefaultTaskAppliesToAll(true);
    fetchDefaultTasks();
  };

  const deleteDefaultTask = async () => {
    if (!deleteDefaultTaskId) return;

    const { error } = await supabase
      .from("default_room_tasks" as any)
      .delete()
      .eq("id", deleteDefaultTaskId);

    if (error) {
      toast.error("Failed to delete default task");
      return;
    }

    setDefaultTasks(defaultTasks.filter(t => t.id !== deleteDefaultTaskId));
    setDeleteDefaultTaskId(null);
    toast.success("Default task deleted (existing tasks in rooms remain)");
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
              <CardContent className="space-y-3">
                <div>
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
                <div>
                  <Label htmlFor="duplicate-from">Copy Tasks From (Optional)</Label>
                  <select
                    id="duplicate-from"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={selectedDuplicateRoomId}
                    onChange={(e) => setSelectedDuplicateRoomId(e.target.value)}
                  >
                    <option value="">Start from scratch</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({roomItems[room.id]?.length || 0} tasks)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a room to copy its tasks to the new room
                  </p>
                </div>
                <Button onClick={addRoom} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Room Template
                </Button>
              </CardContent>
            </Card>

            <Card data-default-tasks-section>
              <CardHeader>
                <CardTitle className="text-base">Default Tasks</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Default tasks are automatically added to all new room templates. Add them to existing rooms too.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Task Description</Label>
                  <Input
                    placeholder="e.g., Check smoke detector"
                    value={defaultTaskDescription}
                    onChange={(e) => setDefaultTaskDescription(e.target.value)}
                    maxLength={500}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Inventory Type (Optional)</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={defaultTaskInventoryType}
                      onChange={(e) => setDefaultTaskInventoryType(e.target.value)}
                    >
                      <option value="">None</option>
                      {inventoryTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      max="99999"
                      placeholder="0"
                      value={defaultTaskQuantity}
                      onChange={(e) => setDefaultTaskQuantity(e.target.value)}
                      disabled={!defaultTaskInventoryType}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Vendor Needed (Optional)</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={defaultTaskVendorType}
                    onChange={(e) => setDefaultTaskVendorType(e.target.value)}
                  >
                    <option value="">None</option>
                    {vendorTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="appliesToAll"
                      checked={defaultTaskAppliesToAll}
                      onChange={(e) => {
                        setDefaultTaskAppliesToAll(e.target.checked);
                        if (e.target.checked) {
                          setDefaultTaskRooms([]);
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor="appliesToAll" className="text-xs font-normal cursor-pointer">
                      Apply to all room templates
                    </Label>
                  </div>

                  {!defaultTaskAppliesToAll && rooms.length > 0 && (
                    <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                      <Label className="text-xs">Select Room Templates</Label>
                      {rooms.map((room) => (
                        <label
                          key={room.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={defaultTaskRooms.includes(room.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDefaultTaskRooms([...defaultTaskRooms, room.id]);
                              } else {
                                setDefaultTaskRooms(defaultTaskRooms.filter(id => id !== room.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{room.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={addDefaultTask} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Default Task
                </Button>

                {defaultTasks.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs">Current Default Tasks</Label>
                    {defaultTasks.map((task) => {
                      const invType = inventoryTypes.find(t => t.id === task.inventory_type_id);
                      const associatedRooms = task.applies_to_all_rooms 
                        ? rooms 
                        : rooms.filter(r => defaultTaskRoomAssociations[task.id]?.includes(r.id));
                      
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                        >
                          <div className="flex-1">
                            <div>{task.description}</div>
                            {invType && (
                              <div className="text-xs text-muted-foreground">
                                {invType.name} × {task.inventory_quantity}
                              </div>
                            )}
                            {task.vendor_type_id && (
                              <div className="text-xs text-muted-foreground">
                                Vendor: {vendorTypes.find(t => t.id === task.vendor_type_id)?.name}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {task.applies_to_all_rooms ? (
                                "Applies to all room templates"
                              ) : (
                                <>Applies to: {associatedRooms.map(r => r.name).join(", ") || "No rooms"}</>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteDefaultTaskId(task.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
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

                              <div>
                                <Label className="text-xs">Vendor Needed</Label>
                                <select
                                  className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  value={newItemVendorType}
                                  onChange={(e) => setNewItemVendorType(e.target.value)}
                                >
                                  <option value="">None</option>
                                  {vendorTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
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
                                  // Check if this item matches a default task that applies to this room
                                  const matchingDefaultTask = defaultTasks.find(dt => 
                                    dt.description === item.description &&
                                    dt.inventory_type_id === item.inventory_type_id &&
                                    dt.inventory_quantity === item.inventory_quantity &&
                                    dt.vendor_type_id === item.vendor_type_id &&
                                    (dt.applies_to_all_rooms || defaultTaskRoomAssociations[dt.id]?.includes(room.id))
                                  );
                                  const isDefaultTask = !!matchingDefaultTask;
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span>{item.description}</span>
                                          {isDefaultTask && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Lock className="h-3 w-3 text-primary" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="text-xs">Controlled by default tasks</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                        {invType && (
                                          <div className="text-xs text-muted-foreground">
                                            {invType.name} × {item.inventory_quantity}
                                          </div>
                                        )}
                                        {item.vendor_type_id && (
                                          <div className="text-xs text-muted-foreground">
                                            Vendor: {vendorTypes.find(t => t.id === item.vendor_type_id)?.name}
                                          </div>
                                        )}
                                      </div>
                                      {isDefaultTask ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs text-primary hover:text-primary"
                                          onClick={() => {
                                            // Scroll to default tasks section
                                            const defaultTasksSection = document.querySelector('[data-default-tasks-section]');
                                            if (defaultTasksSection) {
                                              defaultTasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                          }}
                                        >
                                          Edit <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setDeleteItemId(item.id)}
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      )}
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

      <AlertDialog open={!!deleteDefaultTaskId} onOpenChange={() => setDeleteDefaultTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Default Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this default task? This will not affect tasks already added to room templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteDefaultTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
