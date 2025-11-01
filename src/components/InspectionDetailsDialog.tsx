import { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { FileText, Clock, MapPin, Check, Upload, Send, Trash2, User, X, Plus, Link2, ClipboardList, ChevronDown, ChevronUp, ChevronRight, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddFollowUpDialog from "./AddFollowUpDialog";
import { StartInspectionDialog } from "./StartInspectionDialog";
import { UserAvatar } from "./UserAvatar";
import { AddTaskDialog } from "./AddTaskDialog";
import { InspectionHistoryDialog } from "./InspectionHistoryDialog";

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  property_id: string;
  attachment_url?: string;
  parent_inspection_id?: string;
  unit_id?: string;
  properties: {
    name: string;
    address: string;
  };
  units?: {
    id: string;
    name: string;
  } | null;
}

interface Subtask {
  id: string;
  description: string;
  completed: boolean;
  attachment_url?: string;
  assigned_users?: string[];
  original_inspection_id: string;
  inspection_id: string;
  inspection_run_id?: string | null;
  inventory_quantity?: number;
  inventory_type_id?: string | null;
  vendor_type_id?: string | null;
  created_at: string;
  created_by: string;
  completed_at?: string | null;
  completed_by?: string | null;
  room_name?: string;
  assignedProfiles?: Array<{
    full_name: string;
    email: string;
    avatar_url?: string | null;
  }>;
  creatorProfile?: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
  };
  completedByProfile?: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
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

interface InspectionRun {
  id: string;
  template_id: string | null;
  started_at: string;
  started_by: string;
  completed_at: string | null;
  completed_by: string | null;
  startedByProfile?: {
    full_name: string | null;
    email: string;
  };
  completedByProfile?: {
    full_name: string | null;
    email: string;
  };
  template?: {
    name: string;
  };
}

interface InspectionDetailsDialogProps {
  inspectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getInspectionColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    "S8 - RFT": "bg-inspection-s8-rft",
    "S8 - 1st Annual": "bg-inspection-s8-annual",
    "S8 - Reinspection": "bg-inspection-s8-reinspection",
    "S8 - Abatement Cure": "bg-inspection-s8-abatement",
    "Rental License": "bg-inspection-rental",
    "HUD": "bg-inspection-hud",
  };
  return colorMap[type] || "bg-primary";
};

export default function InspectionDetailsDialog({
  inspectionId,
  open,
  onOpenChange,
}: InspectionDetailsDialogProps) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [parentInspection, setParentInspection] = useState<Inspection | null>(null);
  const [childInspections, setChildInspections] = useState<Inspection[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>([]);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [collapsedRuns, setCollapsedRuns] = useState<Set<string>>(new Set());
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // New subtask form state
  const [newDescription, setNewDescription] = useState("");
  const [newAssignedUsers, setNewAssignedUsers] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState<File>();
  const [isAdding, setIsAdding] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [showAssignAllButton, setShowAssignAllButton] = useState(false);
  const [assignAllUser, setAssignAllUser] = useState<string>("");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [historicalInspections, setHistoricalInspections] = useState<Array<{
    id: string;
    date: string;
    time: string;
    type: string;
    subtaskCount: number;
  }>>([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [inspectionRuns, setInspectionRuns] = useState<InspectionRun[]>([]);

  useEffect(() => {
    if (inspectionId && open) {
      fetchInspectionDetails();
      fetchSubtasks();
      fetchUsers();
      fetchInventoryTypes();
      fetchVendorTypes();
      fetchHistoricalInspections();
      fetchInspectionRuns();
    }
  }, [inspectionId, open]);

  const fetchInspectionDetails = async () => {
    if (!inspectionId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("inspections")
      .select("*, properties(name, address), units(id, name)")
      .eq("id", inspectionId)
      .single();

    if (error) {
      toast.error("Failed to load inspection details");
    } else {
      setInspection(data);
      
      // Fetch parent inspection if exists
      if (data.parent_inspection_id) {
        const { data: parentData } = await supabase
          .from("inspections")
          .select("*, properties(name, address), units(id, name)")
          .eq("id", data.parent_inspection_id)
          .single();
        
        if (parentData) {
          setParentInspection(parentData);
        }
      } else {
        setParentInspection(null);
      }
      
      // Fetch child inspections (follow-ups)
      const { data: childData } = await supabase
        .from("inspections")
        .select("*, properties(name, address), units(id, name)")
        .eq("parent_inspection_id", inspectionId)
        .order("date", { ascending: true });
      
      if (childData) {
        setChildInspections(childData);
      }
    }
    setLoading(false);
  };

  const fetchSubtasks = async () => {
    if (!inspectionId) return;

    // Get all subtasks from the entire inspection chain
    const allSubtasks = await getAllSubtasksInChain(inspectionId);

    // Fetch profiles for assigned users and creators
    const subtasksWithProfiles = await Promise.all(
      allSubtasks.map(async (subtask) => {
        let assignedProfiles = [];
        let creatorProfile = null;
        let completedByProfile = null;

        // Fetch assigned user profiles
        if (subtask.assigned_users && subtask.assigned_users.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("full_name, email, avatar_url")
            .in("id", subtask.assigned_users);

          assignedProfiles = profiles || [];
        }

        // Fetch creator profile
        if (subtask.created_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, avatar_url")
            .eq("id", subtask.created_by)
            .maybeSingle();

          creatorProfile = profile;
        }

        // Fetch completed by profile
        if (subtask.completed_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, avatar_url")
            .eq("id", subtask.completed_by)
            .maybeSingle();

          completedByProfile = profile;
        }

        return { 
          ...subtask, 
          assignedProfiles,
          creatorProfile,
          completedByProfile
        };
      })
    );

    // Sort: incomplete tasks first, then completed tasks
    subtasksWithProfiles.sort((a, b) => {
      if (a.completed === b.completed) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.completed ? 1 : -1;
    });

    setSubtasks(subtasksWithProfiles);
  };

  const getAllSubtasksInChain = async (currentInspectionId: string): Promise<any[]> => {
    // Get current inspection details
    const { data: inspection } = await supabase
      .from("inspections")
      .select("parent_inspection_id")
      .eq("id", currentInspectionId)
      .single();

    // Get subtasks for current inspection
    const { data: subtasks } = await supabase
      .from("subtasks")
      .select("*")
      .eq("inspection_id", currentInspectionId);

    let allSubtasks = subtasks || [];

    // Recursively get subtasks from parent inspection chain
    if (inspection?.parent_inspection_id) {
      const parentSubtasks = await getAllSubtasksInChain(
        inspection.parent_inspection_id
      );
      allSubtasks = [...allSubtasks, ...parentSubtasks];
    }

    // Remove duplicates (keep most recent version of each unique subtask)
    const uniqueSubtasks = Array.from(
      new Map(
        allSubtasks.map((task) => [
          `${task.original_inspection_id}-${task.description}`,
          task,
        ])
      ).values()
    );

    return uniqueSubtasks;
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
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

  const fetchVendorTypes = async () => {
    const { data, error } = await supabase
      .from("vendor_types")
      .select("*")
      .order("name");

    if (error) {
      console.error("Failed to load vendor types:", error);
    } else {
      setVendorTypes(data || []);
    }
  };

  const fetchHistoricalInspections = async () => {
    if (!inspectionId) return;

    // First get the current inspection to determine property/unit
    const { data: currentInspection } = await supabase
      .from("inspections")
      .select("property_id, unit_id")
      .eq("id", inspectionId)
      .maybeSingle();

    if (!currentInspection) return;

    // Fetch all completed inspections for the same property/unit
    let query = supabase
      .from("inspections")
      .select("id, date, time, type")
      .eq("completed", true)
      .eq("property_id", currentInspection.property_id)
      .neq("id", inspectionId)
      .order("date", { ascending: false })
      .order("time", { ascending: false });

    if (currentInspection.unit_id) {
      query = query.eq("unit_id", currentInspection.unit_id);
    } else {
      query = query.is("unit_id", null);
    }

    const { data: inspections } = await query;

    if (inspections) {
      // Count subtasks for each inspection
      const inspectionsWithCounts = await Promise.all(
        inspections.map(async (insp) => {
          const { count } = await supabase
            .from("subtasks")
            .select("*", { count: "exact", head: true })
            .eq("inspection_id", insp.id);

          return {
            ...insp,
            subtaskCount: count || 0
          };
        })
      );

      setHistoricalInspections(inspectionsWithCounts);
    }
  };

  const fetchInspectionRuns = async () => {
    if (!inspectionId) return;

    const { data, error } = await supabase
      .from("inspection_runs")
      .select(`
        *,
        inspection_templates(name)
      `)
      .eq("inspection_id", inspectionId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Failed to load inspection runs:", error);
      return;
    }

    if (data) {
      // Fetch profiles for started_by and completed_by users
      const runsWithProfiles = await Promise.all(
        data.map(async (run) => {
          let startedByProfile = undefined;
          let completedByProfile = undefined;

          if (run.started_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", run.started_by)
              .maybeSingle();

            if (profile) startedByProfile = profile;
          }

          if (run.completed_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", run.completed_by)
              .maybeSingle();

            if (profile) completedByProfile = profile;
          }

          return {
            ...run,
            template: run.inspection_templates,
            startedByProfile,
            completedByProfile,
          };
        })
      );

      setInspectionRuns(runsWithProfiles);
    }
  };

  const handleCreateInventoryType = async (name: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("inventory_types")
      .insert({ name, created_by: user.id });
    
    if (error) {
      toast.error("Failed to create inventory type");
    } else {
      toast.success("Inventory type created");
      fetchInventoryTypes();
    }
  };

  const handleAddTaskFromDialog = async (task: {
    description: string;
    inventory_quantity: number;
    inventory_type_id: string | null;
    vendor_type_id: string | null;
  }) => {
    if (!inspectionId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("subtasks").insert({
        inspection_id: inspectionId,
        original_inspection_id: inspectionId,
        description: task.description.trim(),
        inventory_quantity: task.inventory_quantity || 0,
        inventory_type_id: task.inventory_type_id,
        vendor_type_id: task.vendor_type_id,
        assigned_users: null,
        attachment_url: null,
        created_by: user.id,
        status: 'bad',
      });

      if (error) throw error;

      toast.success("Task added");
      fetchSubtasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to add task");
    }
  };

  const toggleSubtaskComplete = async (subtaskId: string, completed: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const updateData = completed
      ? { completed: false, completed_at: null, completed_by: null }
      : { completed: true, completed_at: new Date().toISOString(), completed_by: user.id };

    const { error } = await supabase
      .from("subtasks")
      .update(updateData)
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to update subtask");
    } else {
      fetchSubtasks();
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const { error } = await supabase
      .from("subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to delete subtask");
    } else {
      toast.success("Subtask deleted");
      fetchSubtasks();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewAttachment(e.target.files[0]);
    }
  };

  const handleAddSubtask = async () => {
    if (!newDescription.trim() || !inspectionId) {
      return;
    }

    setIsAdding(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let attachmentUrl: string | undefined;

      // Upload attachment if provided
      if (newAttachment) {
        const fileExt = newAttachment.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, newAttachment);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("attachments").getPublicUrl(fileName);

        attachmentUrl = publicUrl;
      }

      // Create subtask
      const { error } = await supabase.from("subtasks").insert({
        inspection_id: inspectionId,
        original_inspection_id: inspectionId, // Mark this as the original inspection
        description: newDescription.trim(),
        assigned_users: newAssignedUsers.length > 0 ? newAssignedUsers : null,
        attachment_url: attachmentUrl,
        inventory_quantity: null,
        inventory_type_id: null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Subtask added");
      fetchSubtasks();
      
      // Reset form
      setNewDescription("");
      setNewAssignedUsers([]);
      setNewAttachment(undefined);
      setShowFullForm(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add subtask");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAssignUser = async (subtaskId: string, userId: string) => {
    const subtask = subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    const currentUsers = subtask.assigned_users || [];
    const newUsers = currentUsers.includes(userId) 
      ? currentUsers.filter(id => id !== userId)
      : [...currentUsers, userId];

    const { error } = await supabase
      .from("subtasks")
      .update({ assigned_users: newUsers.length > 0 ? newUsers : null })
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to assign user");
    } else {
      fetchSubtasks();
    }
  };

  const handleDescriptionChange = (value: string, subtaskId?: string) => {
    if (subtaskId) {
      // For editing existing subtasks - not implementing inline edit in this version
      return;
    }
    
    setNewDescription(value);
    
    // Detect @ mentions
    const lastAtSymbol = value.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const textAfterAt = value.slice(lastAtSymbol + 1);
      const hasSpace = textAfterAt.includes(' ');
      
      if (!hasSpace) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentionDropdown(true);
        setCursorPosition(lastAtSymbol);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (user: Profile) => {
    const beforeMention = newDescription.slice(0, cursorPosition);
    const afterMention = newDescription.slice(cursorPosition + mentionQuery.length + 1);
    const userName = user.full_name || user.email;
    
    setNewDescription(`${beforeMention}@${userName} ${afterMention}`);
    
    // Add user to assigned users
    if (!newAssignedUsers.includes(user.id)) {
      setNewAssignedUsers([...newAssignedUsers, user.id]);
    }
    
    setShowMentionDropdown(false);
    setMentionQuery("");
    
    // Refocus textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const filteredMentionUsers = users.filter(user => {
    const searchName = (user.full_name || user.email).toLowerCase();
    return searchName.includes(mentionQuery);
  });

  const toggleRoomCollapse = (roomName: string) => {
    const newCollapsed = new Set(collapsedRooms);
    if (newCollapsed.has(roomName)) {
      newCollapsed.delete(roomName);
    } else {
      newCollapsed.add(roomName);
    }
    setCollapsedRooms(newCollapsed);
  };

  const handleAssignAllUnassigned = async () => {
    if (!assignAllUser) return;

    const unassignedSubtasks = subtasks.filter(
      s => !s.completed && (!s.assigned_users || s.assigned_users.length === 0)
    );

    if (unassignedSubtasks.length === 0) {
      toast.info("No unassigned tasks to assign");
      return;
    }

    try {
      const updates = unassignedSubtasks.map(subtask => 
        supabase
          .from("subtasks")
          .update({ assigned_users: [assignAllUser] })
          .eq("id", subtask.id)
      );

      await Promise.all(updates);
      toast.success(`Assigned ${unassignedSubtasks.length} tasks to ${users.find(u => u.id === assignAllUser)?.full_name || 'user'}`);
      fetchSubtasks();
      setAssignAllUser("");
      setShowAssignAllButton(false);
    } catch (error) {
      toast.error("Failed to assign tasks");
    }
  };

  if (!inspection) return null;

  // Group subtasks by room
  const groupedSubtasks = subtasks.reduce((acc, subtask) => {
    const roomName = subtask.room_name || "Other Tasks";
    if (!acc[roomName]) {
      acc[roomName] = [];
    }
    acc[roomName].push(subtask);
    return acc;
  }, {} as Record<string, Subtask[]>);

  // Calculate total items needed from incomplete subtasks
  const totalItemsNeeded = subtasks
    .filter(s => !s.completed && s.inventory_quantity && s.inventory_quantity > 0)
    .reduce((sum, s) => sum + (s.inventory_quantity || 0), 0);

  const itemsByType = subtasks
    .filter(s => !s.completed && s.inventory_quantity && s.inventory_quantity > 0 && s.inventory_type_id)
    .reduce((acc, s) => {
      const typeId = s.inventory_type_id!;
      if (!acc[typeId]) {
        acc[typeId] = 0;
      }
      acc[typeId] += s.inventory_quantity || 0;
      return acc;
    }, {} as Record<string, number>);

  // Calculate completed items by type
  const completedItemsByType = subtasks
    .filter(s => s.completed && s.inventory_quantity && s.inventory_quantity > 0 && s.inventory_type_id)
    .reduce((acc, s) => {
      const typeId = s.inventory_type_id!;
      if (!acc[typeId]) {
        acc[typeId] = 0;
      }
      acc[typeId] += s.inventory_quantity || 0;
      return acc;
    }, {} as Record<string, number>);

  // Get all unique inventory types used
  const allInventoryTypeIds = new Set([
    ...Object.keys(itemsByType),
    ...Object.keys(completedItemsByType)
  ]);

  const unassignedCount = subtasks.filter(s => !s.completed && (!s.assigned_users || s.assigned_users.length === 0)).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] h-[90vh] sm:max-h-[85vh] sm:h-[85vh] flex flex-col p-0 gap-0">
          {/* Compact Header */}
          <div className="p-3 sm:p-4 pb-2 flex-shrink-0 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getInspectionColor(inspection.type)} text-white text-[10px] sm:text-xs px-2 py-0.5`}>
                  {inspection.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(inspection.date), "MMM d")} • {inspection.time}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateSelector(true)}
                  className="h-7 text-xs px-2"
                >
                  <ClipboardList className="h-3 w-3 mr-1" />
                  <span>Start</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFollowUpDialog(true)}
                  className="h-7 text-xs px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <span>Follow-up</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryDialog(true)}
                  className="h-7 text-xs px-2"
                >
                  <History className="h-3 w-3 mr-1" />
                  <span>History</span>
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-1 text-xs mt-2">
              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">{inspection.properties.name}</div>
                {inspection.units && (
                  <div className="text-muted-foreground text-[10px]">
                    Unit: {inspection.units.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto px-3 sm:px-4 py-3 flex-1">
            {/* Compact Inventory Summary */}
            {(totalItemsNeeded > 0 || Object.keys(completedItemsByType).length > 0) && (
              <div className="mb-3 p-2 bg-primary/5 border border-primary/20 rounded text-xs">
                <div className="font-semibold flex items-center gap-1 mb-1">
                  <ClipboardList className="h-3 w-3" />
                  Items: {totalItemsNeeded} needed
                </div>
                {Object.keys(itemsByType).length > 0 && (
                  <div className="space-y-0.5">
                    {Array.from(allInventoryTypeIds).slice(0, 3).map((typeId) => {
                      const type = inventoryTypes.find(t => t.id === typeId);
                      const neededQty = itemsByType[typeId] || 0;
                      if (!type || neededQty === 0) return null;
                      return (
                        <div key={typeId} className="flex justify-between">
                          <span>{type.name}</span>
                          <span className="font-medium">{neededQty}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Connection Info */}
            {(inspection.parent_inspection_id || childInspections.length > 0) && (
              <div className="mb-3 p-2 bg-accent/20 rounded text-xs space-y-1">
                {inspection.parent_inspection_id && parentInspection && (
                  <div className="flex items-center gap-1">
                    <Link2 className="h-3 w-3 flex-shrink-0" />
                    <span className="text-muted-foreground">Follow-up of: </span>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => {
                        onOpenChange(false);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openInspectionDetails', { 
                            detail: { inspectionId: inspection.parent_inspection_id } 
                          }));
                        }, 100);
                      }}
                    >
                      {parentInspection.type}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Historical Inspections */}
            {historicalInspections.length > 0 && (
              <div className="mb-3 p-2 bg-muted/30 rounded text-xs space-y-1.5">
                <div className="font-medium text-muted-foreground mb-1.5">Previous Inspections at This Location:</div>
                <div className="space-y-1">
                  {historicalInspections.slice(0, 3).map((hist) => (
                    <div key={hist.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {hist.type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {format(new Date(hist.date), "MMM d, yyyy")}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {hist.subtaskCount} issue{hist.subtaskCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                  {historicalInspections.length > 3 && (
                    <div className="text-muted-foreground text-[10px] pt-0.5">
                      +{historicalInspections.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show Completed Toggle */}
            <div className="flex items-center justify-between mb-3 p-2 bg-muted/30 rounded">
              <span className="text-sm font-medium">Show Completed Tasks</span>
              <Button
                variant={showCompleted ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted(!showCompleted)}
                className="h-7 text-xs"
              >
                {showCompleted ? "Hide" : "Show"}
              </Button>
            </div>


            {/* Tasks grouped by room */}
            <div className="space-y-3">
              {(() => {
                // Filter subtasks based on showCompleted
                const filteredSubtasks = showCompleted 
                  ? subtasks 
                  : subtasks.filter(s => !s.completed);

                // Group subtasks by room
                const groupedByRoom = filteredSubtasks.reduce((acc, subtask) => {
                  const room = subtask.room_name || 'No Room';
                  if (!acc[room]) acc[room] = [];
                  acc[room].push(subtask);
                  return acc;
                }, {} as Record<string, Subtask[]>);

                return Object.entries(groupedByRoom).map(([roomName, roomSubtasks]) => {
                const isCollapsed = collapsedRooms.has(roomName);
                const roomCompletedCount = roomSubtasks.filter(s => s.completed).length;
                const allCompleted = roomCompletedCount === roomSubtasks.length;

                return (
                  <div key={roomName} className="border rounded-lg overflow-hidden">
                    {/* Room Header */}
                    <button
                      onClick={() => {
                        setCollapsedRooms(prev => {
                          const next = new Set(prev);
                          if (next.has(roomName)) {
                            next.delete(roomName);
                          } else {
                            next.add(roomName);
                          }
                          return next;
                        });
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-accent/50 transition-colors ${
                        allCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span>{roomName}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {roomCompletedCount}/{roomSubtasks.length}
                        </Badge>
                      </div>
                      {allCompleted && <Check className="h-4 w-4 text-green-600" />}
                    </button>

                    {/* Room Tasks */}
                    {!isCollapsed && (
                      <div className="p-2 space-y-2">
                        {roomSubtasks.map((subtask) => {
                          const isInherited = subtask.original_inspection_id !== inspectionId;
                          const run = inspectionRuns.find(r => r.id === subtask.inspection_run_id);

                          return (
                            <div
                              key={subtask.id}
                              className={`flex items-start gap-2 p-2 border rounded transition-colors ${
                                subtask.completed
                                  ? "bg-muted/30 opacity-60"
                                  : isInherited
                                  ? "bg-accent/20"
                                  : "hover:bg-accent/30"
                              }`}
                            >
                              <Checkbox
                                checked={subtask.completed}
                                onCheckedChange={() => toggleSubtaskComplete(subtask.id, subtask.completed)}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-xs">
                                <div className="flex items-start gap-2 flex-wrap">
                                  <p className={`flex-1 ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
                                    {subtask.description}
                                  </p>
                                  {/* Inspection Run Badge */}
                                  {run && (
                                    <Badge 
                                      variant="secondary" 
                                      className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-secondary/80"
                                      onClick={() => setShowHistoryDialog(true)}
                                    >
                                      <History className="h-2.5 w-2.5 mr-1" />
                                      {run.template?.name || 'Run'} • {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                                    </Badge>
                                  )}
                                </div>

                                {/* Assigned Users */}
                                {subtask.assignedProfiles && subtask.assignedProfiles.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    {subtask.assignedProfiles.slice(0, 3).map((profile, idx) => (
                                      <UserAvatar
                                        key={idx}
                                        avatarUrl={profile.avatar_url}
                                        name={profile.full_name}
                                        email={profile.email}
                                        size="sm"
                                      />
                                    ))}
                                    {subtask.assignedProfiles.length > 3 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{subtask.assignedProfiles.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Creation and Completion Metadata */}
                                <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                                  {subtask.creatorProfile && (
                                    <div>
                                      Created by {subtask.creatorProfile.full_name || subtask.creatorProfile.email} • {formatDistanceToNow(new Date(subtask.created_at), { addSuffix: true })}
                                    </div>
                                  )}
                                  {subtask.completed && subtask.completedByProfile && subtask.completed_at && (
                                    <div className="text-green-600 dark:text-green-400">
                                      Completed by {subtask.completedByProfile.full_name || subtask.completedByProfile.email} • {formatDistanceToNow(new Date(subtask.completed_at), { addSuffix: true })}
                                    </div>
                                  )}
                                </div>

                                {/* Quick Assign Dropdown */}
                                {!subtask.completed && !isInherited && (
                                  <Select
                                    value=""
                                    onValueChange={(userId) => handleAssignUser(subtask.id, userId)}
                                  >
                                    <SelectTrigger className="h-6 text-[10px] mt-1 w-24 px-1">
                                      <SelectValue placeholder="+ Assign" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48">
                                      {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id} className="text-xs">
                                          {user.full_name || user.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              
                              {!isInherited && !subtask.completed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => handleDeleteSubtask(subtask.id)}
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
                );
              });
              })()}

              {/* Add New Task */}
              <Button
                onClick={() => setShowAddTaskDialog(true)}
                variant="outline"
                size="sm"
                className="w-full border-dashed h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>


          {/* Compact Footer - Assign All */}
          {unassignedCount > 0 && (
            <div className="p-2 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">
                  {unassignedCount} unassigned
                </span>
                <Select value={assignAllUser} onValueChange={setAssignAllUser}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Assign all to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-xs">
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignAllUser && (
                  <Button
                    size="sm"
                    onClick={handleAssignAllUnassigned}
                    className="h-7 text-xs"
                  >
                    Assign
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {inspection && (
        <>
          <AddFollowUpDialog
            parentInspection={{
              id: inspection.id,
              type: inspection.type,
              property_id: inspection.property_id,
              unit_id: inspection.unit_id,
              date: inspection.date,
            }}
            open={showFollowUpDialog}
            onOpenChange={setShowFollowUpDialog}
            onSuccess={() => {
              fetchInspectionDetails();
              fetchSubtasks();
            }}
          />

          <AddTaskDialog
            open={showAddTaskDialog}
            onOpenChange={setShowAddTaskDialog}
            onAdd={handleAddTaskFromDialog}
            inventoryTypes={inventoryTypes}
            vendorTypes={vendorTypes}
            onCreateInventoryType={handleCreateInventoryType}
            title="Add Task"
            description="Add a new task to this inspection"
          />

          <StartInspectionDialog
            open={showTemplateSelector}
            onOpenChange={setShowTemplateSelector}
            inspectionId={inspection.id}
            unitId={inspection.unit_id}
            propertyId={inspection.property_id}
            onInspectionStarted={fetchSubtasks}
          />

          <InspectionHistoryDialog
            open={showHistoryDialog}
            onOpenChange={setShowHistoryDialog}
            inspectionId={inspection.id}
            propertyId={inspection.property_id}
            unitId={inspection.unit_id}
          />
        </>
      )}
    </>
  );
}
