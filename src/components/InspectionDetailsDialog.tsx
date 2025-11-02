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
import { UserAvatar } from "./UserAvatar";
import { AddTaskDialog } from "./AddTaskDialog";

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  property_id: string;
  attachment_url?: string;
  parent_inspection_id?: string;
  unit_id?: string;
  inspection_template_id?: string | null;
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
  status?: 'good' | 'bad' | 'pending';
  status_changed_by?: string | null;
  status_changed_at?: string | null;
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
  statusChangedByProfile?: {
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
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>([]);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  
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
  const [showCompleted, setShowCompleted] = useState<'to-do' | 'bad' | 'completed'>('to-do');
  const [subtaskNotes, setSubtaskNotes] = useState<Record<string, string>>({});
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [localStatus, setLocalStatus] = useState<Record<string, 'good' | 'bad' | 'pending'>>({});
  const [subtaskMention, setSubtaskMention] = useState<Record<string, { query: string; atIndex: number }>>({});
  const [subtaskActivities, setSubtaskActivities] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (inspectionId && open) {
      fetchInspectionDetails();
      fetchSubtasks();
      fetchUsers();
      fetchInventoryTypes();
      fetchVendorTypes();
      fetchHistoricalInspections();
    }
  }, [inspectionId, open]);

  // Setup realtime subscription for subtask activities
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('subtask-activity-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtask_activity'
        },
        (payload) => {
          // Refresh activities for the affected subtask
          if (payload.new && 'subtask_id' in payload.new) {
            const subtaskId = (payload.new as any).subtask_id;
            if (expandedActivity[subtaskId]) {
              // Refetch activities for this subtask
              supabase
                .from('subtask_activity')
                .select('*')
                .eq('subtask_id', subtaskId)
                .order('created_at', { ascending: true })
                .then(async ({ data: activities }) => {
                  if (activities) {
                    const creatorIds = [...new Set(activities.map(a => a.created_by))];
                    const { data: profiles } = await supabase
                      .from('profiles')
                      .select('id, full_name, email, avatar_url')
                      .in('id', creatorIds);

                    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
                    const activitiesWithProfiles = activities.map(activity => ({
                      ...activity,
                      created_by_profile: profileMap.get(activity.created_by)
                    }));

                    setSubtaskActivities(prev => ({ ...prev, [subtaskId]: activitiesWithProfiles }));
                  }
                });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, expandedActivity]);

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

      // Load template name if present
      setTemplateName(null);
      if (data.inspection_template_id) {
        const { data: template } = await supabase
          .from("inspection_templates")
          .select("name")
          .eq("id", data.inspection_template_id)
          .maybeSingle();
        setTemplateName(template?.name || null);
      }
      
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

    // Collect all unique user IDs that we need profiles for
    const userIds = new Set<string>();
    allSubtasks.forEach(subtask => {
      if (subtask.assigned_users) {
        subtask.assigned_users.forEach((id: string) => userIds.add(id));
      }
      if (subtask.created_by) userIds.add(subtask.created_by);
      if (subtask.completed_by) userIds.add(subtask.completed_by);
      if (subtask.status_changed_by) userIds.add(subtask.status_changed_by);
    });

    // Fetch all profiles in a single query
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", Array.from(userIds));

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get current inspection template details if exists
    const { data: currentInspection } = await supabase
      .from("inspections")
      .select("inspection_template_id")
      .eq("id", inspectionId)
      .maybeSingle();

    let roomOrder: Map<string, number> = new Map();
    let itemOrderInRoom: Map<string, number> = new Map();

    if (currentInspection?.inspection_template_id) {
      // Fetch template room order
      const { data: templateRooms } = await supabase
        .from("template_rooms")
        .select("id, name, order_index")
        .eq("template_id", currentInspection.inspection_template_id)
        .order("order_index");

      if (templateRooms) {
        templateRooms.forEach((room, idx) => {
          roomOrder.set(room.name, idx);
        });

        // Fetch template items order for each room
        for (const room of templateRooms) {
          const { data: roomItems } = await supabase
            .from("template_items")
            .select("id, description, order_index")
            .eq("room_id", room.id)
            .order("order_index");

          if (roomItems) {
            roomItems.forEach(item => {
              itemOrderInRoom.set(`${room.name}:${item.description}`, item.order_index);
            });
          }
        }
      }
    }

    // Map profiles to subtasks
    const subtasksWithProfiles = allSubtasks.map(subtask => {
      const assignedProfiles = subtask.assigned_users
        ?.map((id: string) => profileMap.get(id))
        .filter(Boolean) || [];
      
      return {
        ...subtask,
        assignedProfiles,
        creatorProfile: subtask.created_by ? profileMap.get(subtask.created_by) : null,
        completedByProfile: subtask.completed_by ? profileMap.get(subtask.completed_by) : null,
        statusChangedByProfile: subtask.status_changed_by ? profileMap.get(subtask.status_changed_by) : null,
      };
    });

    // Sort by template order (room, then item), then by creation date for unmatched
    subtasksWithProfiles.sort((a, b) => {
      // First sort by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      const roomA = a.room_name || "No Room";
      const roomB = b.room_name || "No Room";
      
      const roomOrderA = roomOrder.get(roomA) ?? 999;
      const roomOrderB = roomOrder.get(roomB) ?? 999;

      if (roomOrderA !== roomOrderB) {
        return roomOrderA - roomOrderB;
      }

      // Same room, sort by item order
      const itemKeyA = `${roomA}:${a.description}`;
      const itemKeyB = `${roomB}:${b.description}`;
      
      const itemOrderA = itemOrderInRoom.get(itemKeyA) ?? 999;
      const itemOrderB = itemOrderInRoom.get(itemKeyB) ?? 999;

      if (itemOrderA !== itemOrderB) {
        return itemOrderA - itemOrderB;
      }

      // Fallback to creation date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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

    // Find the current subtask to check its status
    const currentSubtask = subtasks.find(s => s.id === subtaskId);

    const updateData = completed
      ? { completed: false, completed_at: null, completed_by: null }
      : { 
          completed: true, 
          completed_at: new Date().toISOString(), 
          completed_by: user.id,
          // If marking as complete and status is 'bad', change it to 'good'
          ...(currentSubtask?.status === 'bad' ? { 
            status: 'good',
            status_changed_by: user.id,
            status_changed_at: new Date().toISOString()
          } : {})
        };

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

  const handleStatusChange = async (subtaskId: string, newStatus: 'good' | 'bad', currentStatus?: string) => {
    const finalStatus = currentStatus === newStatus ? 'pending' : newStatus;

    // Optimistic update
    setLocalStatus(prev => ({ ...prev, [subtaskId]: finalStatus }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setLocalStatus(prev => { const { [subtaskId]: _, ...rest } = prev; return rest; });
      return;
    }

    const { error } = await supabase
      .from("subtasks")
      .update({
        status: finalStatus,
        status_changed_by: user.id,
        status_changed_at: new Date().toISOString(),
        ...(finalStatus === 'pending' && { attachment_url: null }),
      })
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to update status");
    }

    // Clear local override after backend confirms
    setLocalStatus(prev => { const { [subtaskId]: _, ...rest } = prev; return rest; });
    fetchSubtasks();
  };

  const handleSaveNotes = async (subtaskId: string) => {
    const note = subtaskNotes[subtaskId] || '';
    
    if (!note.trim()) {
      toast.error("Please enter a note");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    // Insert new note activity
    const { error } = await supabase
      .from("subtask_activity")
      .insert({ 
        subtask_id: subtaskId,
        activity_type: 'note_added',
        notes: note,
        created_by: user.id
      });

    if (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to add note');
      return;
    }

    toast.success('Note added');
    
    // Clear the note input
    setSubtaskNotes(prev => ({ ...prev, [subtaskId]: '' }));
    
    // Reload activities to show the new note
    const { data: activities, error: fetchError } = await supabase
      .from('subtask_activity')
      .select('*')
      .eq('subtask_id', subtaskId)
      .order('created_at', { ascending: true });

    if (!fetchError && activities) {
      const creatorIds = [...new Set(activities.map(a => a.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const activitiesWithProfiles = activities.map(activity => ({
        ...activity,
        created_by_profile: profileMap.get(activity.created_by)
      }));

      setSubtaskActivities(prev => ({ ...prev, [subtaskId]: activitiesWithProfiles }));
    }
  };

  const toggleActivity = async (subtaskId: string) => {
    const isExpanding = !expandedActivity[subtaskId];
    setExpandedActivity(prev => ({ ...prev, [subtaskId]: !prev[subtaskId] }));
    
    // Fetch activities if expanding
    if (isExpanding) {
      const { data: activities, error } = await supabase
        .from('subtask_activity')
        .select('*')
        .eq('subtask_id', subtaskId)
        .order('created_at', { ascending: true });

      if (!error && activities) {
        // Fetch all creator profiles
        const creatorIds = [...new Set(activities.map(a => a.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const activitiesWithProfiles = activities.map(activity => ({
          ...activity,
          created_by_profile: profileMap.get(activity.created_by)
        }));

        setSubtaskActivities(prev => ({ ...prev, [subtaskId]: activitiesWithProfiles }));
      }
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

  // Calculate total items needed from subtasks marked as bad
  const totalItemsNeeded = subtasks
    .filter(s => s.status === 'bad' && s.inventory_quantity && s.inventory_quantity > 0)
    .reduce((sum, s) => sum + (s.inventory_quantity || 0), 0);

  const itemsByType = subtasks
    .filter(s => s.status === 'bad' && s.inventory_quantity && s.inventory_quantity > 0 && s.inventory_type_id)
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
                {templateName && (
                  <span className="text-xs text-muted-foreground">
                    Template: {templateName}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFollowUpDialog(true)}
                  className="h-7 text-xs px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <span>Follow-up</span>
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

            {/* Filter Buttons */}
            <div className="flex gap-2 mb-3">
              <Button
                variant={showCompleted === 'to-do' ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted('to-do')}
                className="flex-1 h-8 text-xs"
              >
                To-Do
              </Button>
              <Button
                variant={showCompleted === 'bad' ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted('bad')}
                className="flex-1 h-8 text-xs"
              >
                Bad
              </Button>
              <Button
                variant={showCompleted === 'completed' ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted('completed')}
                className="flex-1 h-8 text-xs"
              >
                Completed
              </Button>
            </div>


            {/* Tasks grouped by room */}
            <div className="space-y-3">
              {(() => {
                // Filter subtasks based on mode
                const filteredSubtasks = subtasks.filter(s => {
                  if (showCompleted === 'bad') return s.status === 'bad';
                  if (showCompleted === 'completed') return s.status === 'good' || s.completed;
                  if (showCompleted === 'to-do') return (s.status === 'bad' || s.status === 'pending' || !s.status) && !s.completed;
                  return true;
                });

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
                    {/* Room Header - Sticky */}
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
                      className={`sticky top-0 z-10 w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-accent/50 transition-colors ${
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
                          const effectiveStatus = localStatus[subtask.id] ?? subtask.status;
                          const isGood = effectiveStatus === 'good';
                          const isBad = effectiveStatus === 'bad';
                          const isPending = !effectiveStatus || effectiveStatus === 'pending';

                          return (
                            <div
                              key={subtask.id}
                              className={`flex items-start gap-2 p-2 border rounded transition-colors ${
                                isGood
                                  ? "bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-600"
                                  : isBad
                                  ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-600"
                                  : subtask.completed
                                  ? "bg-muted/30 opacity-60"
                                  : isInherited
                                  ? "bg-accent/20"
                                  : "hover:bg-accent/30"
                              }`}
                            >
                              <div className="flex-1 min-w-0 text-xs">
                                <div 
                                  className="flex items-start gap-2 flex-wrap mb-2 cursor-pointer hover:bg-muted/30 rounded p-1 -m-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleActivity(subtask.id);
                                  }}
                                >
                                  {expandedActivity[subtask.id] ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  )}
                                  <p className={`flex-1 ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
                                    {subtask.description}
                                  </p>
                                  {isGood && (
                                    <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
                                      Good
                                    </Badge>
                                  )}
                                  {isBad && (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                      Issue
                                    </Badge>
                                  )}
                                </div>

                                {/* Good/Bad Buttons - Always at top */}
                                {!isInherited && !subtask.completed && (
                                  <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1">
                                      <Button
                                        variant={isGood ? "default" : "outline"}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(subtask.id, 'good', subtask.status);
                                        }}
                                        className={`h-6 text-[10px] px-2 ${isGood ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                      >
                                        Good
                                      </Button>
                                      <Button
                                        variant={isBad ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(subtask.id, 'bad', subtask.status);
                                        }}
                                        className="h-6 text-[10px] px-2"
                                      >
                                        Bad
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Notes and Activity (visible when expanded) */}
                                {expandedActivity[subtask.id] && (
                                  <div className="space-y-3">
                                    {/* Add Note Form */}
                                    {!isInherited && (
                                      <div className="space-y-2 relative" onClick={(e) => e.stopPropagation()}>
                                        <Textarea
                                          placeholder="Add a note... (Type @ to mention users)"
                                          value={subtaskNotes[subtask.id] || ''}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const value = e.target.value;
                                            setSubtaskNotes({ ...subtaskNotes, [subtask.id]: value });
                                            const lastAt = value.lastIndexOf('@');
                                            if (lastAt !== -1) {
                                              const after = value.slice(lastAt + 1);
                                              if (!after.includes(' ') && after.length >= 0) {
                                                setSubtaskMention(prev => ({ ...prev, [subtask.id]: { query: after.toLowerCase(), atIndex: lastAt } }));
                                              } else {
                                                setSubtaskMention(prev => ({ ...prev, [subtask.id]: undefined as any }));
                                              }
                                            } else {
                                              setSubtaskMention(prev => ({ ...prev, [subtask.id]: undefined as any }));
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-16 text-xs"
                                        />

                                        {/* Mentions dropdown */}
                                        {subtaskMention[subtask.id]?.query !== undefined && (
                                          <div className="absolute left-0 top-full mt-1 w-56 bg-background border border-border rounded-md shadow-lg z-50">
                                            <ul className="max-h-40 overflow-auto text-xs">
                                              {users
                                                .filter(u => (u.full_name || u.email).toLowerCase().includes(subtaskMention[subtask.id]!.query))
                                                .slice(0, 5)
                                                .map(u => (
                                                  <li
                                                    key={u.id}
                                                    className="px-2 py-1 hover:bg-accent cursor-pointer"
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      const current = subtaskNotes[subtask.id] || '';
                                                      const atIndex = subtaskMention[subtask.id]!.atIndex;
                                                      const before = current.slice(0, atIndex);
                                                      const after = current.slice(atIndex + subtaskMention[subtask.id]!.query.length + 1);
                                                      const name = u.full_name || u.email;
                                                      const next = `${before}@${name} ${after}`;
                                                      setSubtaskNotes({ ...subtaskNotes, [subtask.id]: next });
                                                      setSubtaskMention(prev => ({ ...prev, [subtask.id]: undefined as any }));
                                                      handleAssignUser(subtask.id, u.id);
                                                    }}
                                                  >
                                                    {u.full_name || u.email}
                                                  </li>
                                                ))}
                                            </ul>
                                          </div>
                                        )}

                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveNotes(subtask.id);
                                          }}
                                          className="h-7 text-xs w-full"
                                        >
                                          Add Note
                                        </Button>
                                      </div>
                                    )}

                                    {/* Activity Feed */}
                                    <div className="border-l-2 border-muted pl-3 space-y-2 max-h-48 overflow-y-auto">
                                      {subtaskActivities[subtask.id] && subtaskActivities[subtask.id].length > 0 ? (
                                        subtaskActivities[subtask.id].map((activity: any) => (
                                          <div key={activity.id} className="text-xs">
                                            <div className="flex items-start gap-2">
                                              <div className="w-2 h-2 bg-primary rounded-full mt-1 -ml-[calc(0.75rem+2px)]"></div>
                                              <div className="flex-1">
                                                <div className="font-medium">
                                                  {activity.activity_type === 'created' && 'Created'}
                                                  {activity.activity_type === 'status_change' && `Status: ${activity.old_value} → ${activity.new_value}`}
                                                  {activity.activity_type === 'note_added' && 'Note added'}
                                                  {activity.activity_type === 'completed' && 'Marked complete'}
                                                  {activity.activity_type === 'uncompleted' && 'Unmarked complete'}
                                                </div>
                                                {activity.notes && (
                                                  <div className="text-muted-foreground mt-1">{activity.notes}</div>
                                                )}
                                                <div className="text-muted-foreground text-[10px] mt-0.5">
                                                  {activity.created_by_profile?.full_name || activity.created_by_profile?.email || 'Unknown'} • 
                                                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-xs text-muted-foreground italic py-2">
                                          No activity yet
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

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
                              </div>
                              
                              {!isInherited && !subtask.completed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubtask(subtask.id);
                                  }}
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
                  <SelectContent className="z-50 bg-background">
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

        </>
      )}
    </>
  );
}
