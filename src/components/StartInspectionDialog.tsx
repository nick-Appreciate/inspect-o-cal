import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ClipboardCheck, X } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string | null;
}

interface Room {
  id: string;
  name: string;
  order_index: number;
}

interface Item {
  id: string;
  description: string;
  room_id: string;
  inventory_quantity: number;
  inventory_type_id: string | null;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface InventoryType {
  id: string;
  name: string;
}

interface StartInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionType: string;
  inspectionId: string;
  onInspectionStarted?: () => void;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

export function StartInspectionDialog({
  open,
  onOpenChange,
  inspectionType,
  inspectionId,
  onInspectionStarted,
}: StartInspectionDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [itemsByRoom, setItemsByRoom] = useState<Record<string, Item[]>>({});
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select" | "inspect">("select");
  const [users, setUsers] = useState<Profile[]>([]);
  const [assignToUser, setAssignToUser] = useState<string>("");
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [customItems, setCustomItems] = useState<Array<{
    id: string;
    description: string;
    inventory_quantity: number;
    inventory_type_id: string | null;
  }>>([]);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(0);
  const [newItemType, setNewItemType] = useState("");

  useEffect(() => {
    if (open && inspectionType) {
      fetchTemplates();
      fetchUsers();
      fetchInventoryTypes();
      setStep("select");
      setSelectedTemplate("");
      setRooms([]);
      setItemsByRoom({});
      setCheckedItems(new Set());
      setItemNotes({});
      setAssignToUser("");
      setCustomItems([]);
      setNewItemDescription("");
      setNewItemQuantity(0);
      setNewItemType("");
    }
  }, [open, inspectionType]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("inspection_templates")
      .select("id, name, type")
      .eq("type", inspectionType)
      .order("name");

    if (error) {
      toast.error("Failed to load templates");
      return;
    }

    setTemplates(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("full_name");

    if (error) {
      console.error("Failed to load users:", error);
    } else {
      setUsers(data || []);
    }
  };

  const fetchInventoryTypes = async () => {
    const { data, error } = await supabase
      .from("inventory_types")
      .select("*")
      .order("name");

    if (error) {
      console.error("Failed to load inventory types:", error);
    } else {
      setInventoryTypes(data || []);
    }
  };

  const loadTemplate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    setLoading(true);

    try {
      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("template_rooms")
        .select("*")
        .eq("template_id", selectedTemplate)
        .order("order_index");

      if (roomsError) throw roomsError;

      setRooms(roomsData || []);

      // Fetch items for all rooms
      const itemsMap: Record<string, Item[]> = {};
      for (const room of roomsData || []) {
        const { data: items, error: itemsError } = await supabase
          .from("template_items")
          .select("id, description, room_id, inventory_quantity, inventory_type_id")
          .eq("room_id", room.id)
          .order("order_index");

        if (!itemsError && items) {
          itemsMap[room.id] = items;
        }
      }

      setItemsByRoom(itemsMap);
      setStep("inspect");
    } catch (error: any) {
      toast.error(error.message || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    setCheckedItems(newChecked);
  };

  const updateItemNote = (itemId: string, note: string) => {
    setItemNotes((prev) => ({
      ...prev,
      [itemId]: note,
    }));
  };

  const addCustomItem = () => {
    if (!newItemDescription.trim()) {
      toast.error("Please enter an item description");
      return;
    }

    const newItem = {
      id: `custom-${Date.now()}`,
      description: newItemDescription,
      inventory_quantity: newItemQuantity,
      inventory_type_id: newItemType && newItemType !== "none" ? newItemType : null,
    };

    setCustomItems((prev) => [...prev, newItem]);
    setNewItemDescription("");
    setNewItemQuantity(0);
    setNewItemType("");
    toast.success("Custom item added");
  };

  const removeCustomItem = (itemId: string) => {
    setCustomItems((prev) => prev.filter(item => item.id !== itemId));
    // Also remove from checked items if it was checked
    const newChecked = new Set(checkedItems);
    newChecked.delete(itemId);
    setCheckedItems(newChecked);
  };

  const submitInspection = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create subtasks for all UNCHECKED items (from template and custom)
      const subtasks: any[] = [];
      
      // Add template items
      rooms.forEach((room) => {
        const items = itemsByRoom[room.id] || [];
        items.forEach((item) => {
          if (!checkedItems.has(item.id)) {
            const note = itemNotes[item.id];
            const description = note 
              ? `${item.description}\n\nNotes: ${note}`
              : item.description;
            
            subtasks.push({
              inspection_id: inspectionId,
              original_inspection_id: inspectionId,
              description: description,
              inventory_quantity: item.inventory_quantity,
              inventory_type_id: item.inventory_type_id,
              assigned_users: assignToUser ? [assignToUser] : null,
              created_by: user.id,
            });
          }
        });
      });

      // Add custom items (only unchecked ones)
      customItems.forEach((item) => {
        if (!checkedItems.has(item.id)) {
          const note = itemNotes[item.id];
          const description = note 
            ? `${item.description}\n\nNotes: ${note}`
            : item.description;
          
          subtasks.push({
            inspection_id: inspectionId,
            original_inspection_id: inspectionId,
            description: description,
            inventory_quantity: item.inventory_quantity,
            inventory_type_id: item.inventory_type_id,
            assigned_users: assignToUser ? [assignToUser] : null,
            created_by: user.id,
          });
        }
      });

      if (subtasks.length > 0) {
        const { error: insertError } = await supabase
          .from("subtasks")
          .insert(subtasks);

        if (insertError) throw insertError;
      }

      toast.success(`Inspection complete! ${subtasks.length} issue${subtasks.length !== 1 ? 's' : ''} recorded.`);
      onInspectionStarted?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit inspection");
    } finally {
      setLoading(false);
    }
  };

  const totalItems = Object.values(itemsByRoom).flat().length + customItems.length;
  const checkedCount = checkedItems.size;
  const issuesCount = totalItems - checkedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            {step === "select" ? "Start Inspection" : "Inspection Checklist"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? `Select a template to start the ${inspectionType} inspection`
              : `Check items that pass inspection. Unchecked items will become subtasks.`}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-4 py-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No templates found for {inspectionType}
              </p>
            ) : (
              <div>
                <Label>Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="mb-4 p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {checkedCount} / {totalItems} items checked
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Issues to track:</span>
                <span className="font-medium text-destructive">
                  {issuesCount} item{issuesCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Add Custom Item Section */}
                <div className="p-4 border-2 border-dashed rounded-lg bg-muted/30">
                  <h3 className="font-semibold text-sm mb-3">Add Custom Item</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder="Item description..."
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={newItemQuantity || ""}
                        onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
                      />
                      <Select value={newItemType} onValueChange={setNewItemType}>
                        <SelectTrigger className="col-span-2">
                          <SelectValue placeholder="Type (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="none">None</SelectItem>
                          {inventoryTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addCustomItem} size="sm" className="w-full">
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Custom Items */}
                {customItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">
                      Custom Items
                    </h3>
                    <div className="space-y-2">
                      {customItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border rounded-lg hover:bg-accent/50 transition-colors space-y-2 bg-amber-50/50 dark:bg-amber-950/20"
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checkedItems.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <label
                                className="text-sm cursor-pointer block"
                                onClick={() => toggleItem(item.id)}
                              >
                                {item.description}
                              </label>
                              {item.inventory_quantity > 0 && (
                                <p className="text-xs text-primary font-medium mt-1">
                                  Items needed: {item.inventory_quantity}
                                  {item.inventory_type_id && inventoryTypes.find(t => t.id === item.inventory_type_id)?.name && (
                                    <> {inventoryTypes.find(t => t.id === item.inventory_type_id)?.name}</>
                                  )}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCustomItem(item.id)}
                              className="h-6 w-6"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Add notes (optional)..."
                            value={itemNotes[item.id] || ""}
                            onChange={(e) => updateItemNote(item.id, e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Template Rooms */}
                {rooms.map((room) => {
                  const items = itemsByRoom[room.id] || [];
                  if (items.length === 0) return null;

                  return (
                    <div key={room.id} className="space-y-3">
                      <h3 className="font-semibold text-lg sticky top-0 bg-background py-2 border-b">
                        {room.name}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 border rounded-lg hover:bg-accent/50 transition-colors space-y-2"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={checkedItems.has(item.id)}
                                onCheckedChange={() => toggleItem(item.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <label
                                  className="text-sm cursor-pointer block"
                                  onClick={() => toggleItem(item.id)}
                                >
                                  {item.description}
                                </label>
                                {item.inventory_quantity && item.inventory_quantity > 0 && (
                                  <p className="text-xs text-primary font-medium mt-1">
                                    Items needed: {item.inventory_quantity}
                                    {item.inventory_type_id && inventoryTypes.find(t => t.id === item.inventory_type_id)?.name && (
                                      <> {inventoryTypes.find(t => t.id === item.inventory_type_id)?.name}</>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Textarea
                              placeholder="Add notes (optional)..."
                              value={itemNotes[item.id] || ""}
                              onChange={(e) => updateItemNote(item.id, e.target.value)}
                              className="text-sm min-h-[60px]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {issuesCount > 0 && (
              <div className="mt-4 p-4 border-t space-y-2">
                <Label>Assign all issues to (Optional)</Label>
                <Select value={assignToUser} onValueChange={setAssignToUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user to assign tasks" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All {issuesCount} unchecked item{issuesCount !== 1 ? 's' : ''} will be assigned to this user
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={loadTemplate} disabled={!selectedTemplate || loading}>
                {loading ? "Loading..." : "Start Inspection"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button onClick={submitInspection} disabled={loading}>
                {loading ? "Submitting..." : `Complete Inspection (${issuesCount} issue${issuesCount !== 1 ? 's' : ''})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
