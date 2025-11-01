import { useState, useEffect, useRef } from "react";
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
import { ClipboardCheck, X, Plus, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
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

interface Template {
  id: string;
  name: string;
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
  inspectionId: string;
  unitId?: string;
  propertyId?: string;
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
  inspectionId,
  unitId,
  propertyId,
  onInspectionStarted,
}: StartInspectionDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [itemsByRoom, setItemsByRoom] = useState<Record<string, Item[]>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, 'good' | 'bad' | 'pending'>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select" | "inspect">("select");
  const [users, setUsers] = useState<Profile[]>([]);
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
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showAddInventoryType, setShowAddInventoryType] = useState(false);
  const [newInventoryTypeName, setNewInventoryTypeName] = useState("");
  const [itemAssignments, setItemAssignments] = useState<Record<string, string[]>>({});
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignToUser, setAssignToUser] = useState<string>("");
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [pendingBadItems, setPendingBadItems] = useState<Set<string>>(new Set());
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchUsers();
      fetchInventoryTypes();
      setStep("select");
      setSelectedTemplate("");
      setRooms([]);
      setItemsByRoom({});
      setItemStatus({});
      setExpandedNotes(new Set());
      setItemNotes({});
      setAssignToUser("");
      setCustomItems([]);
      setNewItemDescription("");
      setNewItemQuantity(0);
      setNewItemType("");
      setItemAssignments({});
      setMentionSearch("");
      setShowMentionDropdown(null);
      setShowAssignDialog(false);
      setCollapsedRooms(new Set());
      setShowCompleted(false);
      setShowCloseConfirmation(false);
    }
  }, [open]);

  const fetchTemplates = async () => {
    try {
      let query = supabase
        .from("inspection_templates")
        .select(`
          id, 
          name,
          floorplan_id,
          template_properties(property_id)
        `);

      // If unit is selected, filter by floorplan
      if (unitId) {
        // First get the unit's floorplan
        const { data: unitData, error: unitError } = await supabase
          .from("units")
          .select("floorplan_id")
          .eq("id", unitId)
          .single();

        if (!unitError && unitData?.floorplan_id) {
          query = query.eq("floorplan_id", unitData.floorplan_id);
        }
      } 
      // If no unit but property is selected, filter by property associations
      else if (propertyId) {
        // Get templates associated with this property
        const { data: propertyTemplates, error: propError } = await supabase
          .from("template_properties")
          .select("template_id")
          .eq("property_id", propertyId);

        if (!propError && propertyTemplates && propertyTemplates.length > 0) {
          const templateIds = propertyTemplates.map(pt => pt.template_id);
          query = query.in("id", templateIds);
        }
      }

      const { data, error } = await query.order("name");

      if (error) {
        toast.error("Failed to load templates");
        return;
      }

      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    }
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

      // Fetch items for all rooms (with fallback to room_template_items + default tasks)
      const itemsMap: Record<string, Item[]> = {};
      for (const room of roomsData || []) {
        const allItems: Item[] = [];

        // First try template_items bound to this template_room
        const { data: items, error: itemsError } = await supabase
          .from("template_items")
          .select("id, description, room_id, inventory_quantity, inventory_type_id")
          .eq("room_id", room.id)
          .order("order_index");

        if (!itemsError && items && items.length > 0) {
          allItems.push(...items);
        } else {
          // Fallback: derive from the reusable room_template definition
          if (room.room_template_id) {
            const { data: rtItems, error: rtError } = await supabase
              .from("room_template_items")
              .select("id, description, inventory_quantity, inventory_type_id, order_index")
              .eq("room_template_id", room.room_template_id)
              .order("order_index");

            if (!rtError && rtItems) {
              allItems.push(...rtItems.map((rt) => ({
                id: `rt-${rt.id}`,
                description: rt.description,
                room_id: room.id,
                inventory_quantity: rt.inventory_quantity ?? 0,
                inventory_type_id: rt.inventory_type_id,
              })));
            }
          }
        }

        // Add default tasks for this room template
        if (room.room_template_id) {
          const { data: defaultTasks, error: defaultError } = await supabase
            .from("default_task_room_templates")
            .select(`
              default_task_id,
              default_room_tasks (
                id,
                description,
                inventory_quantity,
                inventory_type_id
              )
            `)
            .eq("room_template_id", room.room_template_id);

          if (!defaultError && defaultTasks) {
            for (const dt of defaultTasks) {
              if (dt.default_room_tasks) {
                allItems.push({
                  id: `default-${dt.default_room_tasks.id}`,
                  description: dt.default_room_tasks.description,
                  room_id: room.id,
                  inventory_quantity: dt.default_room_tasks.inventory_quantity ?? 0,
                  inventory_type_id: dt.default_room_tasks.inventory_type_id,
                });
              }
            }
          }
        }

        itemsMap[room.id] = allItems;
      }

      setItemsByRoom(itemsMap);
      setStep("inspect");
      // Don't collapse rooms by default so users can see all items
      setCollapsedRooms(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const setItemAsGood = (itemId: string, roomId?: string) => {
    setItemStatus(prev => ({ ...prev, [itemId]: 'good' }));
    // Remove from pending bad items
    setPendingBadItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    // Collapse notes when marked good
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    
    // Auto-collapse room if all items have status
    if (roomId) {
      setTimeout(() => {
        const items = itemsByRoom[roomId] || [];
        const allHaveStatus = items.every(item => itemStatus[item.id] && itemStatus[item.id] !== 'pending');
        if (allHaveStatus) {
          setCollapsedRooms(prev => new Set(prev).add(roomId));
        }
      }, 100);
    }
  };

  const setItemAsBad = (itemId: string, roomId?: string) => {
    // Check if notes exist, if not, mark as pending bad
    const currentNote = itemNotes[itemId];
    if (!currentNote || currentNote.trim() === '') {
      // Mark as pending bad - user wants to select bad but hasn't filled notes yet
      setPendingBadItems(prev => new Set(prev).add(itemId));
      // Expand notes to prompt user
      setExpandedNotes(prev => new Set(prev).add(itemId));
      // Focus the textarea
      setTimeout(() => {
        const textarea = textareaRefs.current[itemId];
        if (textarea) {
          textarea.focus();
        }
      }, 100);
      return;
    }

    setItemStatus(prev => ({ ...prev, [itemId]: 'bad' }));
    // Remove from pending bad items since notes are now filled
    setPendingBadItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    // Keep notes expanded when marked bad
    setExpandedNotes(prev => new Set(prev).add(itemId));
    
    // Auto-collapse room if all items have status
    if (roomId) {
      setTimeout(() => {
        const items = itemsByRoom[roomId] || [];
        const allHaveStatus = items.every(item => itemStatus[item.id] && itemStatus[item.id] !== 'pending');
        if (allHaveStatus) {
          setCollapsedRooms(prev => new Set(prev).add(roomId));
        }
      }, 100);
    }
  };

  const toggleNoteExpanded = (itemId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const updateItemNote = (itemId: string, note: string) => {
    setItemNotes((prev) => ({
      ...prev,
      [itemId]: note,
    }));

    // If item is marked as pending bad and notes are now filled, try to complete the bad marking
    if (pendingBadItems.has(itemId) && note.trim()) {
      const roomId = Object.entries(itemsByRoom).find(([_, items]) => 
        items.some(item => item.id === itemId)
      )?.[0];
      
      // Automatically mark as bad now that notes are filled
      setItemStatus(prev => ({ ...prev, [itemId]: 'bad' }));
      setPendingBadItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }

    // Check for @mentions
    const lastAtSymbol = note.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const textAfterAt = note.substring(lastAtSymbol + 1);
      const hasSpaceAfter = textAfterAt.includes(' ') || textAfterAt.includes('\n');
      
      if (!hasSpaceAfter) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentionDropdown(itemId);
        
        // Calculate dropdown position
        const textarea = textareaRefs.current[itemId];
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          setMentionPosition({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
          });
        }
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
    }
  };

  const handleMentionSelect = (itemId: string, user: Profile) => {
    const currentNote = itemNotes[itemId] || "";
    const lastAtSymbol = currentNote.lastIndexOf('@');
    const newNote = currentNote.substring(0, lastAtSymbol) + `@${user.full_name || user.email} `;
    
    setItemNotes((prev) => ({
      ...prev,
      [itemId]: newNote,
    }));

    // Add user to assignments
    setItemAssignments((prev) => {
      const current = prev[itemId] || [];
      if (!current.includes(user.id)) {
        return {
          ...prev,
          [itemId]: [...current, user.id],
        };
      }
      return prev;
    });

    setShowMentionDropdown(null);
    setMentionSearch("");

    toast.success(`Assigned to ${user.full_name || user.email}`);
    
    // Focus back on textarea
    setTimeout(() => {
      const textarea = textareaRefs.current[itemId];
      if (textarea) {
        textarea.focus();
      }
    }, 0);
  };

  const removeAssignment = (itemId: string, userId: string) => {
    setItemAssignments((prev) => {
      const current = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: current.filter(id => id !== userId),
      };
    });
  };

  const filteredMentionUsers = users.filter(user =>
    (user.full_name?.toLowerCase().includes(mentionSearch) ||
     user.email.toLowerCase().includes(mentionSearch))
  );

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
    setShowAddItemDialog(false);
    toast.success("Custom item added");
  };

  const removeCustomItem = (itemId: string) => {
    setCustomItems((prev) => prev.filter(item => item.id !== itemId));
    // Remove item state
    setItemStatus(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const createInventoryType = async () => {
    if (!newInventoryTypeName.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("inventory_types")
        .insert({
          name: newInventoryTypeName.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setInventoryTypes((prev) => [...prev, data]);
      setNewItemType(data.id);
      setNewInventoryTypeName("");
      setShowAddInventoryType(false);
      toast.success("Inventory type created");
    } catch (error: any) {
      toast.error(error.message || "Failed to create inventory type");
    }
  };

  const handleComplete = () => {
    const allItems = [...Object.values(itemsByRoom).flat(), ...customItems];
    const itemsWithoutStatus = allItems.filter(item => !itemStatus[item.id] || itemStatus[item.id] === 'pending');
    
    if (itemsWithoutStatus.length > 0) {
      // Show warning but allow proceeding
      const proceed = window.confirm(
        `${itemsWithoutStatus.length} item${itemsWithoutStatus.length !== 1 ? 's' : ''} still pending. Do you want to complete anyway?`
      );
      if (!proceed) return;
    }

    const badItems = allItems.filter(item => itemStatus[item.id] === 'bad');
    const unassignedBadItems = badItems.filter(item => !itemAssignments[item.id]?.length);

    if (unassignedBadItems.length > 0) {
      setShowAssignDialog(true);
    } else {
      submitInspection();
    }
  };

  const submitInspection = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create subtasks for all BAD items (from template and custom)
      const subtasks: any[] = [];
      
      // Add template items marked as bad
      rooms.forEach((room) => {
        const items = itemsByRoom[room.id] || [];
        items.forEach((item) => {
          if (itemStatus[item.id] === 'bad') {
            const note = itemNotes[item.id];
            const description = note 
              ? `${item.description}\n\nNotes: ${note}`
              : item.description;
            
            // Use individual assignments if available, otherwise use global assignment
            const assignments = itemAssignments[item.id] || (assignToUser ? [assignToUser] : null);
            
            subtasks.push({
              inspection_id: inspectionId,
              original_inspection_id: inspectionId,
              description: description,
              inventory_quantity: item.inventory_quantity > 0 ? item.inventory_quantity : null,
              inventory_type_id: item.inventory_type_id,
              assigned_users: assignments,
              created_by: user.id,
              room_name: room.name,
              status: 'bad',
            });
          }
        });
      });

      // Add custom items marked as bad
      customItems.forEach((item) => {
        if (itemStatus[item.id] === 'bad') {
          const note = itemNotes[item.id];
          const description = note 
            ? `${item.description}\n\nNotes: ${note}`
            : item.description;
          
          // Use individual assignments if available, otherwise use global assignment
          const assignments = itemAssignments[item.id] || (assignToUser ? [assignToUser] : null);
          
          subtasks.push({
            inspection_id: inspectionId,
            original_inspection_id: inspectionId,
            description: description,
            inventory_quantity: item.inventory_quantity > 0 ? item.inventory_quantity : null,
            inventory_type_id: item.inventory_type_id,
            assigned_users: assignments,
            created_by: user.id,
            room_name: "Custom Items",
            status: 'bad',
          });
        }
      });

      if (subtasks.length > 0) {
        const { error: insertError } = await supabase
          .from("subtasks")
          .insert(subtasks);

        if (insertError) throw insertError;
      }

      // Update the inspection to mark it as completed and link to template
      const { error: updateError } = await supabase
        .from("inspections")
        .update({
          completed: true,
          inspection_template_id: selectedTemplate
        })
        .eq("id", inspectionId);

      if (updateError) throw updateError;

      toast.success(`Inspection complete! ${subtasks.length} issue${subtasks.length !== 1 ? 's' : ''} recorded.`);
      onInspectionStarted?.();
      onOpenChange(false);
      setShowAssignDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit inspection");
    } finally {
      setLoading(false);
    }
  };

  const allItems = [...Object.values(itemsByRoom).flat(), ...customItems];
  const totalItems = allItems.length;
  const goodCount = allItems.filter(item => itemStatus[item.id] === 'good').length;
  const badCount = allItems.filter(item => itemStatus[item.id] === 'bad').length;
  const pendingCount = totalItems - goodCount - badCount;

  const handleDialogClose = (open: boolean) => {
    if (!open && pendingCount > 0 && step === 'inspect') {
      setShowCloseConfirmation(true);
    } else {
      onOpenChange(open);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-4 w-4" />
            {step === "select" ? "Start Inspection" : "Inspection Checklist"}
          </DialogTitle>
          {step === "select" && (
            <DialogDescription className="text-xs">
              {unitId 
                ? "Select a template matching this unit's floorplan"
                : "Select a template for this property"}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "select" ? (
          <div className="px-6 py-4 space-y-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {unitId 
                  ? "No templates found matching this unit's floorplan."
                  : "No templates found for this property."}
              </p>
            ) : (
              <div>
                <Label className="text-sm">Template</Label>
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
          <>
            <div className="px-6 py-2 bg-muted shrink-0 border-b">
              <div className="flex justify-between items-center">
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600 font-medium">✓ {goodCount} Good</span>
                  <span className="text-destructive font-medium">✗ {badCount} Bad</span>
                  <span className="text-muted-foreground">⊙ {pendingCount} Pending</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="h-7 text-xs"
                >
                  {showCompleted ? "Hide" : "Show"} Completed
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6">
                {/* Template Rooms */}
                {rooms.map((room) => {
                  const items = itemsByRoom[room.id] || [];
                  if (items.length === 0) return null;

                  const visibleItems = showCompleted 
                    ? items 
                    : items.filter(item => !itemStatus[item.id] || itemStatus[item.id] === 'pending');
                  
                  if (visibleItems.length === 0 && !showCompleted) return null;

                  const isCollapsed = collapsedRooms.has(room.id);
                  const roomGoodCount = items.filter(item => itemStatus[item.id] === 'good').length;
                  const roomBadCount = items.filter(item => itemStatus[item.id] === 'bad').length;
                  const roomPendingCount = items.length - roomGoodCount - roomBadCount;

                  return (
                    <div key={room.id} className="space-y-2">
                      <button
                        onClick={() => {
                          setCollapsedRooms(prev => {
                            const next = new Set(prev);
                            if (next.has(room.id)) {
                              next.delete(room.id);
                            } else {
                              next.add(room.id);
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center justify-between gap-2 font-semibold text-base sticky top-0 bg-background py-2 border-b hover:bg-accent/50 transition-colors z-10"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {room.name}
                        </div>
                        <div className="flex gap-3 text-xs font-normal">
                          <span className="text-green-600">✓ {roomGoodCount}</span>
                          <span className="text-destructive">✗ {roomBadCount}</span>
                          <span className="text-muted-foreground">⊙ {roomPendingCount}</span>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-3 pt-1">
                          {visibleItems.map((item) => {
                            const status = itemStatus[item.id] || 'pending';
                            const isPendingBad = pendingBadItems.has(item.id);
                            const isExpanded = expandedNotes.has(item.id);
                            const assignedUsers = itemAssignments[item.id] || [];
                            return (
                              <div
                                key={item.id}
                                className={`p-3 border rounded-lg transition-all space-y-2 cursor-pointer ${
                                  status === 'good' ? 'border-green-500/50 bg-green-50/50' :
                                  status === 'bad' ? 'border-destructive/50 bg-destructive/5' :
                                  isPendingBad ? 'border-destructive border-2 bg-destructive/10' :
                                  'border-border hover:border-accent-foreground/20 hover:bg-accent/30'
                                }`}
                                onClick={(e) => {
                                  // Prevent collapsing if pending bad (waiting for notes)
                                  if (isPendingBad) return;
                                  
                                  // Only expand if not clicking on buttons or interactive elements
                                  if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('textarea')) {
                                    setExpandedNotes(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) {
                                        next.delete(item.id);
                                      } else {
                                        next.add(item.id);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex gap-1.5 shrink-0">
                                    <Button
                                      size="sm"
                                      variant={status === 'good' ? 'default' : 'outline'}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemAsGood(item.id, room.id);
                                      }}
                                      className={`h-9 w-9 p-0 ${
                                        status === 'good' 
                                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                                          : 'border-green-600/60 text-green-700 hover:bg-green-50 hover:border-green-600'
                                      }`}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={status === 'bad' ? 'default' : 'outline'}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemAsBad(item.id, room.id);
                                      }}
                                      className={`h-9 w-9 p-0 ${
                                        status === 'bad' 
                                          ? 'bg-destructive hover:bg-destructive/90 text-white border-destructive' 
                                          : 'border-destructive/60 text-destructive hover:bg-destructive/5 hover:border-destructive'
                                      }`}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-relaxed">{item.description}</p>
                                    {(item.inventory_quantity && item.inventory_quantity > 0) || item.inventory_quantity === -1 ? (
                                      <p className="text-xs text-primary font-medium mt-1.5">
                                        Items: {item.inventory_quantity === -1 ? "User Selected" : item.inventory_quantity}
                                        {item.inventory_type_id && inventoryTypes.find(t => t.id === item.inventory_type_id)?.name && (
                                          <> {inventoryTypes.find(t => t.id === item.inventory_type_id)?.name}</>
                                        )}
                                      </p>
                                    ) : null}
                                    {assignedUsers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {assignedUsers.map(userId => {
                                          const user = users.find(u => u.id === userId);
                                          return user ? (
                                            <span key={userId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                                              {user.full_name || user.email}
                                              <X 
                                                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                                onClick={() => removeAssignment(item.id, userId)}
                                              />
                                            </span>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="shrink-0">
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="relative mt-2 ml-[84px]">
                                    {isPendingBad && (
                                      <p className="text-xs text-destructive font-medium mb-1">
                                        ⚠️ Notes required to mark as bad
                                      </p>
                                    )}
                                    <Textarea
                                      ref={(el) => {
                                        if (el) textareaRefs.current[item.id] = el;
                                      }}
                                      placeholder="Add notes or @mention to assign..."
                                      value={itemNotes[item.id] || ""}
                                      onChange={(e) => updateItemNote(item.id, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (showMentionDropdown === item.id && filteredMentionUsers.length > 0) {
                                          if (e.key === 'Tab' || e.key === 'Enter') {
                                            e.preventDefault();
                                            handleMentionSelect(item.id, filteredMentionUsers[0]);
                                          } else if (e.key === 'Escape') {
                                            setShowMentionDropdown(null);
                                          }
                                        } else if (e.key === 'Enter' && !e.shiftKey && itemNotes[item.id]?.trim()) {
                                          // Close notes on Enter if notes are filled (and not in mention dropdown)
                                          e.preventDefault();
                                          setExpandedNotes(prev => {
                                            const next = new Set(prev);
                                            next.delete(item.id);
                                            return next;
                                          });
                                        }
                                      }}
                                      className="text-sm min-h-[60px]"
                                      onClick={(e) => e.stopPropagation()}
                                      onBlur={() => {
                                        // Close notes on blur only if notes are filled and not pending bad
                                        const note = itemNotes[item.id];
                                        const isPending = pendingBadItems.has(item.id);
                                        if (note?.trim() && !isPending) {
                                          setTimeout(() => {
                                            setExpandedNotes(prev => {
                                              const next = new Set(prev);
                                              next.delete(item.id);
                                              return next;
                                            });
                                          }, 200);
                                        }
                                      }}
                                    />
                                    {showMentionDropdown === item.id && filteredMentionUsers.length > 0 && (
                                      <div 
                                        ref={mentionDropdownRef}
                                        className="absolute z-50 mt-1 w-full max-h-32 overflow-auto bg-popover border rounded-md shadow-lg"
                                      >
                                        {filteredMentionUsers.map((user, index) => (
                                          <div
                                            key={user.id}
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${index === 0 ? 'bg-accent/50' : ''}`}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleMentionSelect(item.id, user);
                                            }}
                                          >
                                            {user.full_name || user.email}
                                            {index === 0 && <span className="text-xs text-muted-foreground ml-2">(Tab/Enter)</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Custom Items Section */}
                {customItems.length > 0 && (() => {
                  const visibleCustomItems = showCompleted
                    ? customItems
                    : customItems.filter(item => !itemStatus[item.id] || itemStatus[item.id] === 'pending');
                  
                  if (visibleCustomItems.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base border-b pb-2 flex items-center gap-2 sticky top-0 bg-background z-10">
                        <span>Custom Items</span>
                        <span className="text-xs font-normal text-muted-foreground">({visibleCustomItems.length})</span>
                      </h3>
                      <div className="space-y-3 pt-1">
                        {visibleCustomItems.map((item) => {
                          const status = itemStatus[item.id] || 'pending';
                          const isPendingBad = pendingBadItems.has(item.id);
                          const isExpanded = expandedNotes.has(item.id);
                          const assignedUsers = itemAssignments[item.id] || [];
                          return (
                            <div
                              key={item.id}
                              className={`p-3 border-2 border-dashed rounded-lg transition-all space-y-2 cursor-pointer ${
                                status === 'good' ? 'border-green-500/50 bg-green-50/50' :
                                status === 'bad' ? 'border-destructive/50 bg-destructive/5' :
                                isPendingBad ? 'border-destructive border-2 bg-destructive/10' :
                                'border-primary/30 hover:border-primary/50 hover:bg-accent/30'
                              }`}
                              onClick={(e) => {
                                // Prevent collapsing if pending bad
                                if (isPendingBad) return;
                                
                                // Only expand if not clicking on buttons or interactive elements
                                if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('textarea')) {
                                  setExpandedNotes(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) {
                                      next.delete(item.id);
                                    } else {
                                      next.add(item.id);
                                    }
                                    return next;
                                  });
                                }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex gap-1.5 shrink-0">
                                  <Button
                                    size="sm"
                                    variant={status === 'good' ? 'default' : 'outline'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemAsGood(item.id);
                                    }}
                                    className={`h-9 w-9 p-0 ${
                                      status === 'good' 
                                        ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                                        : 'border-green-600/60 text-green-700 hover:bg-green-50 hover:border-green-600'
                                    }`}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={status === 'bad' ? 'default' : 'outline'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemAsBad(item.id);
                                    }}
                                    className={`h-9 w-9 p-0 ${
                                      status === 'bad' 
                                        ? 'bg-destructive hover:bg-destructive/90 text-white border-destructive' 
                                        : 'border-destructive/60 text-destructive hover:bg-destructive/5 hover:border-destructive'
                                    }`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-relaxed">{item.description}</p>
                                  {item.inventory_quantity > 0 || item.inventory_quantity === -1 ? (
                                    <p className="text-xs text-primary font-medium mt-1.5">
                                      Items: {item.inventory_quantity === -1 ? "User Selected" : item.inventory_quantity}
                                      {item.inventory_type_id && inventoryTypes.find(t => t.id === item.inventory_type_id)?.name && (
                                        <> {inventoryTypes.find(t => t.id === item.inventory_type_id)?.name}</>
                                      )}
                                    </p>
                                  ) : null}
                                  {assignedUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {assignedUsers.map(userId => {
                                        const user = users.find(u => u.id === userId);
                                        return user ? (
                                          <span key={userId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                                            {user.full_name || user.email}
                                            <X 
                                              className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                              onClick={() => removeAssignment(item.id, userId)}
                                            />
                                          </span>
                                        ) : null;
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <div>
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCustomItem(item.id);
                                    }}
                                    className="h-8 w-8"
                                    title="Remove custom item"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="relative mt-2 ml-[84px]">
                                  {isPendingBad && (
                                    <p className="text-xs text-destructive font-medium mb-1">
                                      ⚠️ Notes required to mark as bad
                                    </p>
                                  )}
                                  <Textarea
                                    ref={(el) => {
                                      if (el) textareaRefs.current[item.id] = el;
                                    }}
                                    placeholder="Add notes or @mention to assign..."
                                    value={itemNotes[item.id] || ""}
                                    onChange={(e) => updateItemNote(item.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (showMentionDropdown === item.id && filteredMentionUsers.length > 0) {
                                        if (e.key === 'Tab' || e.key === 'Enter') {
                                          e.preventDefault();
                                          handleMentionSelect(item.id, filteredMentionUsers[0]);
                                        } else if (e.key === 'Escape') {
                                          setShowMentionDropdown(null);
                                        }
                                      } else if (e.key === 'Enter' && !e.shiftKey && itemNotes[item.id]?.trim()) {
                                        // Close notes on Enter if notes are filled (and not in mention dropdown)
                                        e.preventDefault();
                                        setExpandedNotes(prev => {
                                          const next = new Set(prev);
                                          next.delete(item.id);
                                          return next;
                                        });
                                      }
                                    }}
                                    className="text-sm min-h-[60px]"
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => {
                                      // Close notes on blur only if notes are filled and not pending bad
                                      const note = itemNotes[item.id];
                                      const isPending = pendingBadItems.has(item.id);
                                      if (note?.trim() && !isPending) {
                                        setTimeout(() => {
                                          setExpandedNotes(prev => {
                                            const next = new Set(prev);
                                            next.delete(item.id);
                                            return next;
                                          });
                                        }, 200);
                                      }
                                    }}
                                  />
                                  {showMentionDropdown === item.id && filteredMentionUsers.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full max-h-32 overflow-auto bg-popover border rounded-md shadow-lg">
                                      {filteredMentionUsers.map((user, index) => (
                                        <div
                                          key={user.id}
                                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${index === 0 ? 'bg-accent/50' : ''}`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleMentionSelect(item.id, user);
                                          }}
                                        >
                                          {user.full_name || user.email}
                                          {index === 0 && <span className="text-xs text-muted-foreground ml-2">(Tab/Enter)</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="px-6 py-3 border-t shrink-0">
          {step === "select" ? (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={loadTemplate} disabled={!selectedTemplate || loading} className="flex-1">
                {loading ? "Loading..." : "Start"}
              </Button>
            </div>
          ) : (
            <div className="w-full flex gap-2">
              <Button variant="outline" onClick={() => setStep("select")} size="sm">
                Back
              </Button>
              <Button onClick={handleComplete} disabled={loading} className="flex-1" size="sm">
                {loading ? "Submitting..." : `Complete (${badCount} issue${badCount !== 1 ? 's' : ''})`}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Assign Unassigned Issues Dialog */}
      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Unassigned Issues</AlertDialogTitle>
            <AlertDialogDescription>
              You have {allItems.filter(item => itemStatus[item.id] === 'bad' && !itemAssignments[item.id]?.length).length} unassigned issues. Would you like to assign them to a user?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm">Assign to</Label>
            <Select value={assignToUser} onValueChange={setAssignToUser}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAssignDialog(false);
              setAssignToUser("");
            }}>
              Skip
            </AlertDialogCancel>
            <AlertDialogAction onClick={submitInspection} disabled={!assignToUser || loading}>
              {loading ? "Submitting..." : "Assign & Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Custom Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Custom Item</DialogTitle>
            <DialogDescription>
              Add a custom item to the inspection checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Item description..."
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemDescription.trim()) {
                    addCustomItem();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (Optional)</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                placeholder="0"
                value={newItemQuantity || ""}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="type">Inventory Type (Optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddInventoryType(!showAddInventoryType)}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Type
                </Button>
              </div>
              
              {showAddInventoryType ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type name..."
                    value={newInventoryTypeName}
                    onChange={(e) => setNewInventoryTypeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newInventoryTypeName.trim()) {
                        createInventoryType();
                      } else if (e.key === "Escape") {
                        setShowAddInventoryType(false);
                        setNewInventoryTypeName("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={createInventoryType}
                    disabled={!newInventoryTypeName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddInventoryType(false);
                      setNewInventoryTypeName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select value={newItemType} onValueChange={setNewItemType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
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
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addCustomItem} disabled={!newItemDescription.trim()}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Unassigned Issues Dialog */}
      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Unassigned Issues</AlertDialogTitle>
            <AlertDialogDescription>
              You have {allItems.filter(item => itemStatus[item.id] === 'bad' && !itemAssignments[item.id]?.length).length} unassigned issues. Would you like to assign them to a user?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm">Assign to</Label>
            <Select value={assignToUser} onValueChange={setAssignToUser}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAssignDialog(false);
              setAssignToUser("");
            }}>
              Skip
            </AlertDialogCancel>
            <AlertDialogAction onClick={submitInspection} disabled={!assignToUser || loading}>
              {loading ? "Submitting..." : "Assign & Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Confirmation Dialog */}
      <AlertDialog open={showCloseConfirmation} onOpenChange={setShowCloseConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Incomplete Inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {pendingCount} item{pendingCount !== 1 ? 's' : ''} that haven't been reviewed yet. Are you sure you want to close this inspection? All progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCloseConfirmation(false)}>
              Continue Inspection
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowCloseConfirmation(false);
              onOpenChange(false);
            }} className="bg-destructive hover:bg-destructive/90">
              Close Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
