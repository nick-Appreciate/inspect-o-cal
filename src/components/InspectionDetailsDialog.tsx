import { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { FileText, Clock, MapPin, Check, Upload, Send, Trash2, User, X, Plus, Link2, ClipboardList, ChevronDown, ChevronUp, ChevronRight, History, Calendar as CalendarIcon, Edit } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddFollowUpDialog from "./AddFollowUpDialog";
import { UserAvatar } from "./UserAvatar";
import { AddTaskDialog } from "./AddTaskDialog";
import { AlertCircle } from "lucide-react";
import SetInventoryQuantityDialog from "./SetInventoryQuantityDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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
  status?: 'pending' | 'passed' | 'failed';
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
  status?: 'pass' | 'fail' | 'pending';
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
  const [showCompleted, setShowCompleted] = useState<'to-do' | 'fail' | 'completed'>('to-do');
  const [subtaskNotes, setSubtaskNotes] = useState<Record<string, string>>({});
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [localStatus, setLocalStatus] = useState<Record<string, 'pass' | 'fail' | 'pending'>>({});
  const [subtaskMention, setSubtaskMention] = useState<Record<string, { query: string; atIndex: number }>>({});
  const [subtaskActivities, setSubtaskActivities] = useState<Record<string, any[]>>({});
  const [pendingFailSubtask, setPendingFailSubtask] = useState<string | null>(null);
  const [failDialogNote, setFailDialogNote] = useState("");
  const [failDialogAssignee, setFailDialogAssignee] = useState<string>("");
  const [failDialogInventoryQuantity, setFailDialogInventoryQuantity] = useState<string>("");
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [selectedQuantitySubtask, setSelectedQuantitySubtask] = useState<Subtask | null>(null);
  
  // Multi-unit inspection state
  const [isMultiUnitInspection, setIsMultiUnitInspection] = useState(false);
  const [unitTemplates, setUnitTemplates] = useState<Array<{
    unit_id: string | null;
    template_id: string;
    unit_name: string;
    template_name: string;
  }>>([]);
  const [expandedUnitTemplates, setExpandedUnitTemplates] = useState<Set<string>>(new Set());
  const [inspectionRuns, setInspectionRuns] = useState<Map<string, { template_id: string, unit_id: string | null }>>(new Map());
  
  // Reschedule state
  const [showReschedulePopover, setShowReschedulePopover] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState("");

  useEffect(() => {
    if (inspectionId && open) {
      fetchInspectionDetails();
      fetchSubtasks();
      fetchUsers();
      fetchInventoryTypes();
      fetchVendorTypes();
      fetchHistoricalInspections();
      fetchUnitTemplates();
    }
  }, [inspectionId, open]);

  // Initialize reschedule fields when inspection loads
  useEffect(() => {
    if (inspection && open) {
      // Use noon in America/Chicago to avoid off-by-one due to timezone parsing
      setRescheduleDate(fromZonedTime(`${inspection.date}T12:00:00`, 'America/Chicago'));
      setRescheduleTime(inspection.time);
    }
  }, [inspection, open]);

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

  // Setup realtime subscription for subtasks (for live updates when tasks are added/removed)
  useEffect(() => {
    if (!open || !inspectionId) return;

    const channel = supabase
      .channel('subtask-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtasks'
        },
        (payload) => {
          // Refresh subtasks whenever any change occurs
          fetchSubtasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'template_items'
        },
        async (payload) => {
          // When template items change, sync to open inspections that use this template
          // This ensures that changes in templates propagate to active inspections
          if (!inspection?.inspection_template_id) return;
          
          fetchSubtasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_template_items'
        },
        async (payload) => {
          // When room template items change, sync to open inspections
          if (!inspection?.inspection_template_id) return;
          
          fetchSubtasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'default_task_room_templates'
        },
        async (payload) => {
          // When default tasks are added/removed from room templates, sync to open inspections
          if (!inspection?.inspection_template_id) return;
          
          fetchSubtasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, inspectionId, inspection?.inspection_template_id]);

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
      setInspection(data as any);

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
          setParentInspection(parentData as any);
        }
      } else {
        setParentInspection(null);
      }
      
      // Fetch child inspections (follow-ups)
      const { data: childData } = await supabase
        .from("inspections")
        .select("*, properties(name, address), units(id, name)")
        .eq("parent_inspection_id", inspectionId)
        .eq("archived", false)
        .order("date", { ascending: true });
      
      if (childData) {
        setChildInspections(childData as any);
      }
    }
    setLoading(false);
  };

  const fetchSubtasks = async () => {
    if (!inspectionId) return;

    // Get all subtasks from the entire inspection chain without pagination limit
    const allSubtasks = await getAllSubtasksInChain(inspectionId);
    
    console.log(`Total subtasks fetched: ${allSubtasks.length}`);

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

    // Fetch inspection_rooms for ordering (preserves template structure)
    const { data: inspectionRooms } = await supabase
      .from("inspection_rooms")
      .select("id, name, order_index")
      .eq("inspection_id", inspectionId)
      .order("order_index");

    // Build room ordering maps
    const roomNameToOrder = new Map<string, number>();
    const roomIdToOrder = new Map<string, number>();
    
    if (inspectionRooms) {
      inspectionRooms.forEach((room) => {
        roomNameToOrder.set(room.name, room.order_index);
        roomIdToOrder.set(room.id, room.order_index);
      });
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

    // Sort by room order, then task order within room
    subtasksWithProfiles.sort((a, b) => {
      // First sort by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Then by room order (using inspection_room_id or room_name)
      const roomOrderA = a.inspection_room_id 
        ? (roomIdToOrder.get(a.inspection_room_id) ?? 999)
        : (roomNameToOrder.get(a.room_name || "No Room") ?? 999);
      const roomOrderB = b.inspection_room_id 
        ? (roomIdToOrder.get(b.inspection_room_id) ?? 999)
        : (roomNameToOrder.get(b.room_name || "No Room") ?? 999);

      if (roomOrderA !== roomOrderB) {
        return roomOrderA - roomOrderB;
      }

      // Then by task order within room
      const taskOrderA = a.order_index ?? 999;
      const taskOrderB = b.order_index ?? 999;

      if (taskOrderA !== taskOrderB) {
        return taskOrderA - taskOrderB;
      }

      // Fallback to creation date
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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

    // Fetch ALL subtasks using pagination to avoid 1000 limit
    let allSubtasks: any[] = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: subtasks, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("inspection_id", currentInspectionId)
        .range(from, from + pageSize - 1);
        
      if (error) {
        console.error("Error fetching subtasks:", error);
        break;
      }
      
      if (!subtasks || subtasks.length === 0) break;
      
      allSubtasks = [...allSubtasks, ...subtasks];
      
      if (subtasks.length < pageSize) break;
      
      from += pageSize;
    }

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
          `${task.original_inspection_id}-${task.inspection_room_id || task.room_name || 'no-room'}-${task.description}`,
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
      .eq("archived", false)
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
  
  const fetchUnitTemplates = async () => {
    if (!inspectionId) return;
    
    try {
      // Fetch raw associations without relying on FK joins
      const { data: unitTemplateRows, error: assocError } = await supabase
        .from("inspection_unit_templates")
        .select("unit_id, template_id")
        .eq("inspection_id", inspectionId);

      if (assocError) {
        console.error("Failed to fetch unit/template associations:", assocError);
        return;
      }

      if (unitTemplateRows && unitTemplateRows.length > 0) {
        setIsMultiUnitInspection(true);

        const unitIds = Array.from(new Set(unitTemplateRows.map(r => r.unit_id).filter(Boolean))) as string[];
        const templateIds = Array.from(new Set(unitTemplateRows.map(r => r.template_id)));

        // Parallel fetch unit and template names
        const [unitsRes, templatesRes] = await Promise.all([
          unitIds.length > 0
            ? supabase.from("units").select("id, name").in("id", unitIds)
            : Promise.resolve({ data: [] as any[] }),
          templateIds.length > 0
            ? supabase.from("inspection_templates").select("id, name").in("id", templateIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const unitMap = new Map((unitsRes.data || []).map((u: any) => [u.id, u.name]));
        const templateMap = new Map((templatesRes.data || []).map((t: any) => [t.id, t.name]));

        const formatted = unitTemplateRows.map((r: any) => ({
          unit_id: r.unit_id,
          template_id: r.template_id,
          unit_name: r.unit_id ? unitMap.get(r.unit_id) || "Unknown Unit" : "Entire Property",
          template_name: templateMap.get(r.template_id) || "Unknown Template",
        }));

        setUnitTemplates(formatted);
        if (formatted.length > 0) {
          setExpandedUnitTemplates(new Set([`${formatted[0].unit_id || 'entire'}-${formatted[0].template_id}`]));
        }

        // Fetch inspection runs with unit ids
        const { data: runsData } = await supabase
          .from("inspection_runs")
          .select("id, template_id, unit_id")
          .eq("inspection_id", inspectionId);

        if (runsData) {
          const runsMap = new Map<string, { template_id: string, unit_id: string | null }>();
          runsData.forEach((run) => {
            runsMap.set(run.id, {
              template_id: run.template_id || '',
              unit_id: run.unit_id ?? null,
            });
          });
          setInspectionRuns(runsMap);
        }
      } else {
        setIsMultiUnitInspection(false);
      }
    } catch (error) {
      console.error("Error fetching unit templates:", error);
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
        status: 'fail',
      });

      if (error) throw error;

      toast.success("Task added");
      fetchSubtasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to add task");
    }
  };

  const handleInspectionStatusChange = async (newStatus: 'passed' | 'failed') => {
    if (!inspectionId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const finalStatus = inspection?.status === newStatus ? 'pending' : newStatus;

    const { error } = await supabase
      .from("inspections")
      .update({ status: finalStatus })
      .eq("id", inspectionId);

    if (error) {
      toast.error("Failed to update inspection status");
      return;
    }

    toast.success(`Inspection marked as ${finalStatus}`);
    fetchInspectionDetails();
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
          // If marking as complete and status is 'fail', change it to 'pass'
          ...(currentSubtask?.status === 'fail' ? { 
            status: 'pass',
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

  const handleStatusChange = async (subtaskId: string, newStatus: 'pass' | 'fail', currentStatus?: string) => {
    const subtask = subtasks.find((s) => s.id === subtaskId);
    
    // Check if subtask has inventory type but no quantity set
    if (subtask?.inventory_type_id && (!subtask.inventory_quantity || subtask.inventory_quantity === 0)) {
      setSelectedQuantitySubtask(subtask);
      setQuantityDialogOpen(true);
      return;
    }

    // If clicking fail, open the fail modal and block closing until submitted or canceled
    if (newStatus === 'fail' && currentStatus !== 'fail') {
      const st = subtasks.find((s) => s.id === subtaskId);
      setFailDialogAssignee(st?.assigned_users?.[0] || "");
      setFailDialogNote("");
      setPendingFailSubtask(subtaskId);
      return;
    }

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

  // Fail confirmation dialog handlers
  const handleFailDialogCancel = () => {
    setPendingFailSubtask(null);
    setFailDialogNote("");
    setFailDialogAssignee("");
    setFailDialogInventoryQuantity("");
  };

  const handleFailDialogSubmit = async () => {
    if (!pendingFailSubtask) return;
    const note = failDialogNote.trim();
    if (!note) {
      toast.error("Please enter a note");
      return;
    }
    if (!failDialogAssignee) {
      toast.error("Please select an assignee");
      return;
    }
    const currentSubtask = subtasks.find(s => s.id === pendingFailSubtask);
    
    // Validate inventory quantity if the subtask has an inventory type
    if (currentSubtask?.inventory_type_id) {
      const qty = parseInt(failDialogInventoryQuantity);
      if (!failDialogInventoryQuantity || isNaN(qty) || qty <= 0) {
        toast.error("Please enter a valid quantity for the inventory item");
        return;
      }
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    const existing = currentSubtask?.assigned_users || [];
    const updatedAssignees = Array.from(new Set([...existing, failDialogAssignee]));

    const updateData: any = {
      assigned_users: updatedAssignees,
      status: "fail",
      status_changed_by: user.id,
      status_changed_at: new Date().toISOString(),
    };

    // Add inventory quantity if applicable
    if (currentSubtask?.inventory_type_id && failDialogInventoryQuantity) {
      updateData.inventory_quantity = parseInt(failDialogInventoryQuantity);
    }

    const { error: updateError } = await supabase
      .from("subtasks")
      .update(updateData)
      .eq("id", pendingFailSubtask);

    if (updateError) {
      toast.error("Failed to update task");
      return;
    }

    const { error: noteError } = await supabase
      .from("subtask_activity")
      .insert({
        subtask_id: pendingFailSubtask,
        activity_type: "note_added",
        notes: note,
        created_by: user.id,
      });

    if (noteError) {
      toast.error("Failed to add note");
      return;
    }

    toast.success("Task marked as failed");
    handleFailDialogCancel();
    fetchSubtasks();
  };

  const handleSaveNotes = async (subtaskId: string) => {
    const note = subtaskNotes[subtaskId] || "";

    if (!note.trim()) {
      toast.error("Please enter a note");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    // If this is completing a pending fail, require assignment and persist the fail now
    if (pendingFailSubtask === subtaskId) {
      const currentSubtask = subtasks.find((s) => s.id === subtaskId);
      if (!currentSubtask?.assigned_users || currentSubtask.assigned_users.length === 0) {
        toast.error("Please assign a user (use @mention) before completing the fail");
        return;
      }

      const { error: statusError } = await supabase
        .from("subtasks")
        .update({
          status: "fail",
          status_changed_by: user.id,
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", subtaskId);

      if (statusError) {
        toast.error("Failed to update status");
        return;
      }

      setPendingFailSubtask(null);
    }

    // Insert new note activity
    const { error } = await supabase
      .from("subtask_activity")
      .insert({
        subtask_id: subtaskId,
        activity_type: "note_added",
        notes: note,
        created_by: user.id,
      });

    if (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to add note");
      return;
    }

    toast.success(
      pendingFailSubtask === subtaskId ? "Task marked as failed with note" : "Note added"
    );

    // Clear the note input
    setSubtaskNotes((prev) => ({ ...prev, [subtaskId]: "" }));

    // Reload activities to show the new note
    const { data: activities, error: fetchError } = await supabase
      .from("subtask_activity")
      .select("*")
      .eq("subtask_id", subtaskId)
      .order("created_at", { ascending: true });

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

  // Calculate total items needed from subtasks marked as fail
  const totalItemsNeeded = subtasks
    .filter(s => s.status === 'fail' && s.inventory_quantity && s.inventory_quantity > 0)
    .reduce((sum, s) => sum + (s.inventory_quantity || 0), 0);

  const itemsByType = subtasks
    .filter(s => s.status === 'fail' && s.inventory_quantity && s.inventory_quantity > 0 && s.inventory_type_id)
    .reduce((acc, s) => {
      const typeId = s.inventory_type_id!;
      if (!acc[typeId]) {
        acc[typeId] = 0;
      }
      acc[typeId] += s.inventory_quantity || 0;
      return acc;
    }, {} as Record<string, number>);

  // Calculate tasks by vendor type from subtasks marked as fail
  const tasksByVendorType = subtasks
    .filter(s => s.status === 'fail' && s.vendor_type_id)
    .reduce((acc, s) => {
      const vendorTypeId = s.vendor_type_id!;
      if (!acc[vendorTypeId]) {
        acc[vendorTypeId] = 0;
      }
      acc[vendorTypeId] += 1;
      return acc;
    }, {} as Record<string, number>);

  const totalVendorTasks = Object.values(tasksByVendorType).reduce((sum, count) => sum + count, 0);

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

  const handleSaveInventoryQuantity = async (quantity: number) => {
    if (!selectedQuantitySubtask) return;

    const { error } = await supabase
      .from("subtasks")
      .update({ inventory_quantity: quantity })
      .eq("id", selectedQuantitySubtask.id);

    if (error) {
      toast.error("Failed to update quantity");
    } else {
      toast.success("Quantity updated");
      fetchSubtasks();
    }
    
    setSelectedQuantitySubtask(null);
  };

  return (
    <>
      <SetInventoryQuantityDialog
        open={quantityDialogOpen}
        onOpenChange={setQuantityDialogOpen}
        subtaskDescription={selectedQuantitySubtask?.description || ""}
        inventoryTypeName={
          inventoryTypes.find((t) => t.id === selectedQuantitySubtask?.inventory_type_id)?.name || ""
        }
        currentQuantity={selectedQuantitySubtask?.inventory_quantity || undefined}
        onSave={handleSaveInventoryQuantity}
      />
      
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && pendingFailSubtask) { toast.error("Complete or cancel the fail action first."); return; } onOpenChange(nextOpen); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] h-[90vh] sm:max-h-[85vh] sm:h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Inspection Details</DialogTitle>
            <DialogDescription>View and manage inspection subtasks</DialogDescription>
          </DialogHeader>
          {/* Header */}
          <div className="p-3 sm:p-4 pr-12 flex-shrink-0 border-b space-y-3">
            {/* Inspection Info Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${getInspectionColor(inspection.type)} text-white text-xs px-2.5 py-0.5`}>
                {inspection.type}
              </Badge>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {formatInTimeZone(new Date(inspection.date + 'T00:00:00'), 'America/Chicago', "MMM d, yyyy")} • {inspection.time}
                </span>
                <Popover open={showReschedulePopover} onOpenChange={setShowReschedulePopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                      title="Reschedule"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Date</label>
                        <Calendar
                          mode="single"
                          selected={rescheduleDate}
                          onSelect={setRescheduleDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Time</label>
                        <Input
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={async () => {
                            if (!rescheduleDate || !rescheduleTime) {
                              toast.error("Please select both date and time");
                              return;
                            }
                            
                            const newDate = formatInTimeZone(rescheduleDate, 'America/Chicago', 'yyyy-MM-dd');
                            
                            const { error } = await supabase
                              .from('inspections')
                              .update({
                                date: newDate,
                                time: rescheduleTime
                              })
                              .eq('id', inspectionId);
                            
                            if (error) {
                              toast.error('Failed to reschedule inspection');
                            } else {
                              toast.success('Inspection rescheduled');
                              setShowReschedulePopover(false);
                              await fetchInspectionDetails();
                              // Trigger refresh in parent
                              window.dispatchEvent(new CustomEvent('inspectionUpdated'));
                            }
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowReschedulePopover(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {templateName && (
                <Badge variant="outline" className="text-xs">
                  {templateName}
                </Badge>
              )}
            </div>

            {/* Property Info + Action Buttons Row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-1.5 text-xs min-w-0 flex-[2]">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{inspection.properties.name}</div>
                  {inspection.units && (
                    <div className="text-muted-foreground text-[11px]">
                      Unit: {inspection.units.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFollowUpDialog(true)}
                  className="h-8 text-xs px-2"
                  title="Create Follow-up"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1.5">Follow-up</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete inspection"
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to delete this inspection?')) return;
                    const { error } = await supabase
                      .from('inspections')
                      .update({ archived: true })
                      .eq('id', inspectionId);
                    if (error) {
                      toast.error('Failed to delete inspection');
                    } else {
                      toast.success('Inspection deleted');
                      onOpenChange(false);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1.5">Delete</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 relative">
            {/* Pass/Fail Buttons - Sticky */}
            <div className="sticky top-0 z-30 bg-background border-b will-change-transform">
              <div className="flex gap-2 px-3 sm:px-4 py-2">
                <Button
                  variant={inspection?.status === 'passed' ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleInspectionStatusChange('passed')}
                  className={`flex-1 h-7 ${inspection?.status === 'passed' ? 'bg-green-600 hover:bg-green-700' : 'border-green-600 text-green-600 hover:bg-green-50'}`}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Pass Inspection
                </Button>
                <Button
                  variant={inspection?.status === 'failed' ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleInspectionStatusChange('failed')}
                  className={`flex-1 h-7 ${inspection?.status === 'failed' ? 'bg-destructive hover:bg-destructive/90' : 'border-destructive text-destructive hover:bg-destructive/10'}`}
                >
                  <X className="h-3 w-3 mr-1" />
                  Fail Inspection
                </Button>
              </div>
            </div>

            <div className="px-3 sm:px-4 pb-3">
            {/* Compact Inventory Summary - Items Needed from Failed Tasks */}
            {totalItemsNeeded > 0 && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="font-semibold flex items-center gap-2 mb-2 text-destructive">
                  <ClipboardList className="h-4 w-4" />
                  <span className="text-base">Items Needed: {totalItemsNeeded} total</span>
                </div>
                {Object.keys(itemsByType).length > 0 && (
                  <div className="space-y-1 pl-6">
                    {Object.entries(itemsByType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([typeId, qty]) => {
                        const type = inventoryTypes.find(t => t.id === typeId);
                        if (!type || qty === 0) return null;
                        return (
                          <div key={typeId} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{type.name}</span>
                            <span className="font-semibold text-destructive">{qty}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Vendor Type Summary - Tasks by Vendor from Failed Tasks */}
            {totalVendorTasks > 0 && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="font-semibold flex items-center gap-2 mb-2 text-destructive">
                  <User className="h-4 w-4" />
                  <span className="text-base">Vendor Tasks: {totalVendorTasks} total</span>
                </div>
                {Object.keys(tasksByVendorType).length > 0 && (
                  <div className="space-y-1 pl-6">
                    {Object.entries(tasksByVendorType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([vendorTypeId, count]) => {
                        const vendor = vendorTypes.find(v => v.id === vendorTypeId);
                        if (!vendor || count === 0) return null;
                        return (
                          <div key={vendorTypeId} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{vendor.name}</span>
                            <span className="font-semibold text-destructive">{count}</span>
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to delete this follow-up inspection?')) {
                          return;
                        }
                        const { error } = await supabase
                          .from('inspections')
                          .update({ archived: true })
                          .eq('id', inspectionId);
                        
                        if (error) {
                          toast.error('Failed to delete follow-up');
                        } else {
                          toast.success('Follow-up deleted');
                          onOpenChange(false);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
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
                          {formatInTimeZone(new Date(hist.date + 'T00:00:00'), 'America/Chicago', "MMM d, yyyy")}
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

            {/* Filter Buttons with Counters - Sticky */}
            <div className="sticky top-[45px] z-30 bg-background border-b will-change-transform">
              <div className="flex gap-2 px-3 sm:px-4 py-2">
                <Button
                  variant={showCompleted === 'to-do' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCompleted('to-do')}
                  className="flex-1 h-7 text-xs"
                >
                  To-Do
                </Button>
                <Button
                  variant={showCompleted === 'fail' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCompleted('fail')}
                  className="flex-1 h-7 text-xs relative"
                >
                  Failed
                  {subtasks.filter(s => s.status === 'fail').length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                      {subtasks.filter(s => s.status === 'fail').length}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant={showCompleted === 'completed' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCompleted('completed')}
                  className="flex-1 h-7 text-xs"
                >
                  Passed
                </Button>
              </div>
            </div>


            {/* Tasks grouped by unit/template, then room */}
            <div className="space-y-2">
              {(() => {
                // Filter subtasks based on mode
                const filteredSubtasks = subtasks.filter(s => {
                  const effective = localStatus[s.id] ?? s.status;
                  if (showCompleted === 'fail') return effective === 'fail';
                  if (showCompleted === 'completed') return effective === 'pass' || s.completed;
                  if (showCompleted === 'to-do') return (effective === 'fail' || effective === 'pending' || !effective) && !s.completed;
                  return true;
                });

                // For multi-unit inspections, group by unit/template first
                if (isMultiUnitInspection && unitTemplates.length > 0) {
                  // Determine if there's a single run combination for fallback
                  const runCombos = new Set(Array.from(inspectionRuns.values()).map(v => `${v.template_id}|${v.unit_id || 'null'}`));
                  const singleRunKey = runCombos.size === 1 ? Array.from(runCombos)[0] : null;

                  return unitTemplates.map(ut => {
                    const unitKey = `${ut.unit_id || 'entire'}-${ut.template_id}`;
                    const isUnitExpanded = expandedUnitTemplates.has(unitKey);
                    const utKey = `${ut.template_id}|${ut.unit_id || 'null'}`;
                    
                    // Filter subtasks for this unit/template
                    const unitSubtasks = filteredSubtasks.filter(s => {
                      if (s.inspection_run_id) {
                        const runInfo = inspectionRuns.get(s.inspection_run_id);
                        return runInfo?.template_id === ut.template_id && runInfo?.unit_id === ut.unit_id;
                      }
                      // Fallback: if only one run combo exists, attribute null-run subtasks to it
                      if (singleRunKey && singleRunKey === utKey) return true;
                      return false;
                    });
                    
                    if (unitSubtasks.length === 0) return null;
                    
                    // Group by room within this unit/template
                    const groupedByRoom = unitSubtasks.reduce((acc, subtask) => {
                      const room = subtask.room_name || 'No Room';
                      if (!acc[room]) acc[room] = [];
                      acc[room].push(subtask);
                      return acc;
                    }, {} as Record<string, Subtask[]>);
                    
                    const totalCompleted = unitSubtasks.filter(s => s.completed).length;
                    const allCompleted = totalCompleted === unitSubtasks.length;
                    
                    return (
                      <div key={unitKey} className="border rounded-lg">
                        {/* Unit/Template Header */}
                        <button
                          onClick={() => {
                            setExpandedUnitTemplates(prev => {
                              const next = new Set(prev);
                              if (next.has(unitKey)) {
                                next.delete(unitKey);
                              } else {
                                next.add(unitKey);
                              }
                              return next;
                            });
                          }}
                          className={`${isUnitExpanded ? "sticky top-[86px] z-20 " : ""}w-full px-3 py-2 flex items-center justify-between text-sm font-semibold hover:bg-accent/50 transition-colors ${
                            allCompleted ? "bg-green-100 dark:bg-green-950/30" : "bg-accent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isUnitExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            <div className="text-left">
                              <div className="font-bold">{ut.unit_name}</div>
                              <div className="text-xs text-muted-foreground font-normal">{ut.template_name}</div>
                            </div>
                            <Badge variant="outline" className="text-xs px-2 py-0.5">
                              {totalCompleted}/{unitSubtasks.length}
                            </Badge>
                          </div>
                          {allCompleted && <Check className="h-5 w-5 text-green-600" />}
                        </button>
                        
                        {/* Rooms within this unit/template */}
                        {isUnitExpanded && (
                          <div className="space-y-0">
                            {Object.entries(groupedByRoom).map(([roomName, roomSubtasks]) => {
                              const roomKey = `${unitKey}-${roomName}`;
                              const isCollapsed = collapsedRooms.has(roomKey);
                              const roomCompletedCount = roomSubtasks.filter(s => s.completed).length;
                              const allRoomCompleted = roomCompletedCount === roomSubtasks.length;

                              return (
                                <div key={roomKey}>
                                  {/* Room Header */}
                                  <button
                                    onClick={() => {
                                      setCollapsedRooms(prev => {
                                        const next = new Set(prev);
                                        if (next.has(roomKey)) {
                                          next.delete(roomKey);
                                        } else {
                                          next.add(roomKey);
                                        }
                                        return next;
                                      });
                                    }}
                                    className={`sticky top-[130px] z-[15] w-full px-3 pt-3 pb-2 flex items-center justify-between text-sm font-medium hover:bg-accent/50 transition-colors border-b ${
                                      allRoomCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-card"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                      <span>{roomName}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {roomCompletedCount}/{roomSubtasks.length}
                                      </Badge>
                                    </div>
                                    {allRoomCompleted && <Check className="h-4 w-4 text-green-600" />}
                                  </button>

                                   {/* Room Tasks */}
                                   {!isCollapsed && (
                                     <div className="p-2 space-y-2 bg-background">
                                       {roomSubtasks.map((subtask) => {
                          const isInherited = subtask.original_inspection_id !== inspectionId;
                          const effectiveStatus = localStatus[subtask.id] ?? subtask.status;
                          const isPass = effectiveStatus === 'pass';
                          const isFail = effectiveStatus === 'fail';
                          const isPending = !effectiveStatus || effectiveStatus === 'pending';

                          return (
                            <div
                              key={subtask.id}
                              className={`flex items-start gap-2 p-2 border rounded transition-colors ${
                                isPass
                                  ? "bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-600"
                                  : isFail
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
                                   {subtask.inventory_type_id && (!subtask.inventory_quantity || subtask.inventory_quantity === 0) && (
                                     <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 bg-amber-50">
                                       Needs Qty
                                     </Badge>
                                   )}
                                   {isPass && (
                                     <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">
                                       Pass
                                     </Badge>
                                   )}
                                   {isFail && (
                                     <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                       Fail
                                     </Badge>
                                   )}
                                </div>

                                {/* Pass/Fail Buttons - Modern Design */}
                                {!isInherited && !subtask.completed && (
                                  <div className="mb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant={isPass ? "default" : "outline"}
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(subtask.id, 'pass', subtask.status);
                                      }}
                                      className={`flex-1 h-8 font-semibold transition-all ${
                                        isPass 
                                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                                          : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                                      }`}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      Pass
                                    </Button>
                                    <Button
                                      variant={isFail ? "destructive" : "outline"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(subtask.id, 'fail', subtask.status);
                                      }}
                                      className={`flex-1 h-8 font-semibold transition-all ${
                                        isFail 
                                          ? 'shadow-md' 
                                          : 'hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                      }`}
                                    >
                                      <X className="h-3.5 w-3.5 mr-1" />
                                      Fail
                                    </Button>
                                  </div>
                                )}

                                {/* Notes and Activity (visible when expanded) */}
                                {expandedActivity[subtask.id] && (
                                  <div className="space-y-3">
                                    {/* Add Note Form */}
                                    {!isInherited && (
                                      <div className="space-y-2 relative" onClick={(e) => e.stopPropagation()}>
                                        {pendingFailSubtask === subtask.id && (
                                          <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            Add notes and assign a user (@mention) to complete marking as failed
                                          </div>
                                        )}
                                        <Textarea
                                          data-subtask-id={subtask.id}
                                          placeholder="Add a note... (Type @ to mention and assign users)"
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
                                                setSubtaskMention(prev => {
                                                  const newMention = { ...prev };
                                                  delete newMention[subtask.id];
                                                  return newMention;
                                                });
                                              }
                                            } else {
                                              setSubtaskMention(prev => {
                                                const newMention = { ...prev };
                                                delete newMention[subtask.id];
                                                return newMention;
                                              });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            e.stopPropagation();
                                            // Handle Tab for autocomplete
                                            if (e.key === 'Tab' && subtaskMention[subtask.id]?.query !== undefined) {
                                              e.preventDefault();
                                              const filteredUsers = users.filter(u => 
                                                (u.full_name || u.email).toLowerCase().includes(subtaskMention[subtask.id]!.query)
                                              );
                                              if (filteredUsers.length > 0) {
                                                const firstUser = filteredUsers[0];
                                                const current = subtaskNotes[subtask.id] || '';
                                                const atIndex = subtaskMention[subtask.id]!.atIndex;
                                                const before = current.slice(0, atIndex);
                                                const after = current.slice(atIndex + subtaskMention[subtask.id]!.query.length + 1);
                                                const name = firstUser.full_name || firstUser.email;
                                                const next = `${before}@${name} ${after}`;
                                                setSubtaskNotes({ ...subtaskNotes, [subtask.id]: next });
                                                setSubtaskMention(prev => {
                                                  const newMention = { ...prev };
                                                  delete newMention[subtask.id];
                                                  return newMention;
                                                });
                                                handleAssignUser(subtask.id, firstUser.id);
                                              }
                                            }
                                            // Handle Enter to submit
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleSaveNotes(subtask.id);
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className={`h-16 text-xs ${
                                            pendingFailSubtask === subtask.id 
                                              ? 'border-destructive border-2 focus-visible:ring-destructive' 
                                              : ''
                                          }`}
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
                                                    className="px-2 py-1.5 hover:bg-accent cursor-pointer flex items-center gap-2"
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      const current = subtaskNotes[subtask.id] || '';
                                                      const atIndex = subtaskMention[subtask.id]!.atIndex;
                                                      const before = current.slice(0, atIndex);
                                                      const after = current.slice(atIndex + subtaskMention[subtask.id]!.query.length + 1);
                                                      const name = u.full_name || u.email;
                                                      const next = `${before}@${name} ${after}`;
                                                      setSubtaskNotes({ ...subtaskNotes, [subtask.id]: next });
                                                      setSubtaskMention(prev => {
                                                        const newMention = { ...prev };
                                                        delete newMention[subtask.id];
                                                        return newMention;
                                                      });
                                                      handleAssignUser(subtask.id, u.id);
                                                    }}
                                                  >
                                                    <UserAvatar
                                                      avatarUrl={u.avatar_url}
                                                      name={u.full_name}
                                                      size="sm"
                                                    />
                                                    {u.full_name || u.email}
                                                    <span className="ml-auto text-[10px] text-muted-foreground">Tab</span>
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
                                          className={`h-7 text-xs w-full ${
                                            pendingFailSubtask === subtask.id 
                                              ? 'bg-destructive hover:bg-destructive/90' 
                                              : ''
                                          }`}
                                        >
                                          {pendingFailSubtask === subtask.id ? 'Complete Fail with Note' : 'Add Note'}
                                        </Button>
                                        <p className="text-[10px] text-muted-foreground text-center">
                                          Press Enter to submit • Tab to autocomplete
                                        </p>
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
                              })}
                          </div>
                        )}
                      </div>
                    );
                  });
                }
                
                // For single-unit inspections, group by room only
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
                    <div key={roomName} className="rounded-lg">
                      {/* Room Header - Sticky with border and background */}
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
                        className={`sticky top-[130px] z-[15] w-full px-3 pt-3 pb-2 flex items-center justify-between text-sm font-medium hover:bg-accent/50 transition-colors border-x border-b will-change-transform ${
                          allCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-card"
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
                        <div className="p-2 space-y-2 border-x border-b rounded-b-lg">
                          {roomSubtasks.map((subtask) => {
                            const isInherited = subtask.original_inspection_id !== inspectionId;
                            const effectiveStatus = localStatus[subtask.id] ?? subtask.status;
                            const isPass = effectiveStatus === 'pass';
                            const isFail = effectiveStatus === 'fail';
                            const isPending = !effectiveStatus || effectiveStatus === 'pending';

                            return (
                              <div
                                key={subtask.id}
                                className={`flex items-start gap-2 p-2 border rounded transition-colors ${
                                  isPass
                                    ? "bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-600"
                                    : isFail
                                    ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-600"
                                    : subtask.completed
                                    ? "bg-muted/30 opacity-60"
                                    : isInherited
                                    ? "bg-accent/20"
                                    : "hover:bg-accent/30"
                                }`}
                              >
                                 {/* This renders the same as the multi-unit version above */}
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
                                      {subtask.inventory_type_id && (!subtask.inventory_quantity || subtask.inventory_quantity === 0) && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 bg-amber-50">
                                          Needs Qty
                                        </Badge>
                                      )}
                                      {isPass && (
                                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">
                                          Pass
                                        </Badge>
                                      )}
                                      {isFail && (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                          Fail
                                        </Badge>
                                      )}
                                   </div>

                                   {/* Pass/Fail Buttons - Modern Design */}
                                   {!isInherited && !subtask.completed && (
                                     <div className="mb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                       <Button
                                         variant={isPass ? "default" : "outline"}
                                         size="sm"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleStatusChange(subtask.id, 'pass', subtask.status);
                                         }}
                                         className={`flex-1 h-8 font-semibold transition-all ${
                                           isPass 
                                             ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                                             : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                                         }`}
                                       >
                                         <Check className="h-3.5 w-3.5 mr-1" />
                                         Pass
                                       </Button>
                                       <Button
                                         variant={isFail ? "destructive" : "outline"}
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleStatusChange(subtask.id, 'fail', subtask.status);
                                         }}
                                         className={`flex-1 h-8 font-semibold transition-all ${
                                           isFail 
                                             ? 'shadow-md' 
                                             : 'hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                         }`}
                                       >
                                         <X className="h-3.5 w-3.5 mr-1" />
                                         Fail
                                       </Button>
                                     </div>
                                   )}

                                   {/* Notes and Activity (visible when expanded) */}
                                   {expandedActivity[subtask.id] && (
                                     <div className="space-y-3">
                                       {/* Add Note Form */}
                                       {!isInherited && (
                                         <div className="space-y-2 relative" onClick={(e) => e.stopPropagation()}>
                                           {pendingFailSubtask === subtask.id && (
                                             <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-2">
                                               <AlertCircle className="h-4 w-4" />
                                               Add notes and assign a user (@mention) to complete marking as failed
                                             </div>
                                           )}
                                           <Textarea
                                             data-subtask-id={subtask.id}
                                             placeholder="Add a note... (Type @ to mention and assign users)"
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
                                                   setSubtaskMention(prev => {
                                                     const newMention = { ...prev };
                                                     delete newMention[subtask.id];
                                                     return newMention;
                                                   });
                                                 }
                                               } else {
                                                 setSubtaskMention(prev => {
                                                   const newMention = { ...prev };
                                                   delete newMention[subtask.id];
                                                   return newMention;
                                                 });
                                               }
                                             }}
                                             onKeyDown={(e) => {
                                               e.stopPropagation();
                                               // Handle Tab for autocomplete
                                               if (e.key === 'Tab' && subtaskMention[subtask.id]?.query !== undefined) {
                                                 e.preventDefault();
                                                 const filteredUsers = users.filter(u => 
                                                   (u.full_name || u.email).toLowerCase().includes(subtaskMention[subtask.id]!.query)
                                                 );
                                                 if (filteredUsers.length > 0) {
                                                   const firstUser = filteredUsers[0];
                                                   const current = subtaskNotes[subtask.id] || '';
                                                   const atIndex = subtaskMention[subtask.id]!.atIndex;
                                                   const before = current.slice(0, atIndex);
                                                   const after = current.slice(atIndex + subtaskMention[subtask.id]!.query.length + 1);
                                                   const name = firstUser.full_name || firstUser.email;
                                                   const next = `${before}@${name} ${after}`;
                                                   setSubtaskNotes({ ...subtaskNotes, [subtask.id]: next });
                                                   setSubtaskMention(prev => {
                                                     const newMention = { ...prev };
                                                     delete newMention[subtask.id];
                                                     return newMention;
                                                   });
                                                   handleAssignUser(subtask.id, firstUser.id);
                                                 }
                                               }
                                               // Handle Enter to submit
                                               if (e.key === 'Enter' && !e.shiftKey) {
                                                 e.preventDefault();
                                                 handleSaveNotes(subtask.id);
                                               }
                                             }}
                                             onClick={(e) => e.stopPropagation()}
                                             className={`h-16 text-xs ${
                                               pendingFailSubtask === subtask.id 
                                                 ? 'border-destructive border-2 focus-visible:ring-destructive' 
                                                 : ''
                                             }`}
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
                                                       className="px-2 py-1.5 hover:bg-accent cursor-pointer flex items-center gap-2"
                                                       onMouseDown={(e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         const current = subtaskNotes[subtask.id] || '';
                                                         const atIndex = subtaskMention[subtask.id]!.atIndex;
                                                         const before = current.slice(0, atIndex);
                                                         const after = current.slice(atIndex + subtaskMention[subtask.id]!.query.length + 1);
                                                         const name = u.full_name || u.email;
                                                         const next = `${before}@${name} ${after}`;
                                                         setSubtaskNotes({ ...subtaskNotes, [subtask.id]: next });
                                                         setSubtaskMention(prev => {
                                                           const newMention = { ...prev };
                                                           delete newMention[subtask.id];
                                                           return newMention;
                                                         });
                                                         handleAssignUser(subtask.id, u.id);
                                                       }}
                                                     >
                                                       <UserAvatar
                                                         avatarUrl={u.avatar_url}
                                                         name={u.full_name}
                                                         size="sm"
                                                       />
                                                       {u.full_name || u.email}
                                                       <span className="ml-auto text-[10px] text-muted-foreground">Tab</span>
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
                                             className={`h-7 text-xs w-full ${
                                               pendingFailSubtask === subtask.id 
                                                 ? 'bg-destructive hover:bg-destructive/90' 
                                                 : ''
                                             }`}
                                           >
                                             {pendingFailSubtask === subtask.id ? 'Complete Fail with Note' : 'Add Note'}
                                           </Button>
                                           <p className="text-[10px] text-muted-foreground text-center">
                                             Press Enter to submit • Tab to autocomplete
                                           </p>
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

          <Dialog open={!!pendingFailSubtask} onOpenChange={(o) => { if (!o) handleFailDialogCancel(); }}>
            <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Mark task as Failed</DialogTitle>
                <DialogDescription>Assign a user and add notes to confirm failure.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Assign to</label>
                  <Select value={failDialogAssignee} onValueChange={setFailDialogAssignee}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-background border shadow-lg" position="popper" sideOffset={4}>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="text-sm cursor-pointer">
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {pendingFailSubtask && subtasks.find(s => s.id === pendingFailSubtask)?.inventory_type_id && (
                  <div>
                    <label className="text-sm font-medium">
                      Quantity Needed ({inventoryTypes.find(t => t.id === subtasks.find(s => s.id === pendingFailSubtask)?.inventory_type_id)?.name})
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={failDialogInventoryQuantity}
                      onChange={(e) => setFailDialogInventoryQuantity(e.target.value)}
                      placeholder="Enter quantity needed"
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={failDialogNote}
                    onChange={(e) => setFailDialogNote(e.target.value)}
                    placeholder="Describe why this failed..."
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleFailDialogCancel}>Cancel</Button>
                  <Button className="bg-destructive hover:bg-destructive/90" onClick={handleFailDialogSubmit}>Submit</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </>
      )}
    </>
  );
}
