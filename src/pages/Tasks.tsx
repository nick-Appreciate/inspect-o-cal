import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, LogOut, Calendar, MapPin, User, Users, Plus, Check, X, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import EditSubtaskDialog from "@/components/EditSubtaskDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface SubtaskActivity {
  id: string;
  activity_type: string;
  notes?: string;
  created_at: string;
  created_by: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface SubtaskWithInspection {
  id: string;
  description: string;
  completed: boolean;
  attachment_url?: string;
  assigned_users?: string[];
  inspection_id: string;
  status?: string;
  inventory_type_id?: string;
  inventory_quantity?: number;
  room_name?: string;
  inspections: {
    id: string;
    type: string;
    date: string;
    time: string;
    properties: {
      name: string;
      address: string;
    };
  };
  assignedProfiles?: Array<{
    full_name: string;
    email: string;
    avatar_url?: string | null;
  }>;
  activities?: SubtaskActivity[];
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

export default function Tasks() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<SubtaskWithInspection[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [inventoryTypes, setInventoryTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [pendingFailSubtask, setPendingFailSubtask] = useState<string | null>(null);
  const [failDialogNote, setFailDialogNote] = useState("");
  const [failDialogAssignee, setFailDialogAssignee] = useState<string>("");
  const [failDialogInventoryQuantity, setFailDialogInventoryQuantity] = useState<string>("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchInventoryTypes();
      fetchUsers();
    }
  }, [user, showAllTasks, showCompleted]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    setUsers(data || []);
  };

  const fetchInventoryTypes = async () => {
    const { data } = await supabase
      .from("inventory_types")
      .select("id, name")
      .order("name");
    setInventoryTypes(data || []);
  };

  const handleCreateInventoryType = async (name: string) => {
    const { error } = await supabase
      .from("inventory_types")
      .insert({ name, created_by: user!.id });
    
    if (error) {
      toast.error("Failed to create inventory type");
    } else {
      toast.success("Inventory type created");
      fetchInventoryTypes();
    }
  };

  const handleAddTask = async (task: {
    description: string;
    inventory_quantity: number;
    inventory_type_id: string | null;
  }) => {
    // For manually added tasks without inspection context, we need to handle this appropriately
    // For now, we'll show an error since tasks should be added in context of an inspection
    toast.error("Please add tasks from the inspection details view");
  };

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);

    let query = supabase
      .from("subtasks")
      .select(`
        *,
        inspections!inspection_id (
          id,
          type,
          date,
          time,
          properties (
            name,
            address
          )
        )
      `);

    if (!showCompleted) {
      query = query.eq("completed", false);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
      setLoading(false);
      return;
    }

    // Fetch profiles for assigned users and activities with notes
    const tasksWithProfiles = await Promise.all(
      (data || []).map(async (task) => {
        const promises = [];
        
        // Fetch assigned user profiles
        if (task.assigned_users && task.assigned_users.length > 0) {
          promises.push(
            supabase
              .from("profiles")
              .select("full_name, email, avatar_url")
              .in("id", task.assigned_users)
          );
        } else {
          promises.push(Promise.resolve({ data: [] }));
        }

        // Fetch activities with notes
        promises.push(
          supabase
            .from("subtask_activity")
            .select(`
              id,
              activity_type,
              notes,
              created_at,
              created_by,
              profiles:created_by (full_name, email)
            `)
            .eq("subtask_id", task.id)
            .not("notes", "is", null)
            .order("created_at", { ascending: false })
        );

        const [profilesResult, activitiesResult] = await Promise.all(promises);

        return {
          ...task,
          assignedProfiles: profilesResult.data || [],
          activities: activitiesResult.data || [],
        };
      })
    );

    // Filter by assigned user if not showing all tasks
    let filteredTasks = tasksWithProfiles;
    if (!showAllTasks) {
      filteredTasks = tasksWithProfiles.filter(
        (task) => task.assigned_users && task.assigned_users.includes(user.id)
      );
    }

    // Sort by inspection date
    filteredTasks.sort((a, b) => {
      const dateA = new Date(a.inspections.date);
      const dateB = new Date(b.inspections.date);
      return dateA.getTime() - dateB.getTime();
    });

    setTasks(filteredTasks);
    setLoading(false);
  };

  const handleStatusChange = async (subtaskId: string, newStatus: 'pass' | 'fail') => {
    if (newStatus === 'fail') {
      setPendingFailSubtask(subtaskId);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const updateData: any = {
      status: newStatus,
      status_changed_by: user.id,
      status_changed_at: new Date().toISOString(),
    };

    if (newStatus === 'pass') {
      updateData.completed = true;
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = user.id;
    }

    const { error } = await supabase
      .from("subtasks")
      .update(updateData)
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to update task");
    } else {
      toast.success(`Task marked as ${newStatus}`);
      fetchTasks();
    }
  };

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
    const currentSubtask = tasks.find(s => s.id === pendingFailSubtask);
    
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
    fetchTasks();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Group tasks by inspection
  const groupTasksByInspection = (taskList: SubtaskWithInspection[]) => {
    const grouped = new Map<string, {
      inspection: SubtaskWithInspection['inspections'];
      tasks: SubtaskWithInspection[];
    }>();

    taskList.forEach((task) => {
      const inspectionId = task.inspections.id;
      if (!grouped.has(inspectionId)) {
        grouped.set(inspectionId, {
          inspection: task.inspections,
          tasks: [],
        });
      }
      grouped.get(inspectionId)!.tasks.push(task);
    });

    return Array.from(grouped.values());
  };

  // Separate tasks into upcoming and overdue
  const upcomingTasks = tasks.filter(
    (task) => !isPast(parseISO(task.inspections.date))
  );
  const overdueTasks = tasks.filter((task) =>
    isPast(parseISO(task.inspections.date))
  );

  const groupedUpcoming = groupTasksByInspection(upcomingTasks);
  const groupedOverdue = groupTasksByInspection(overdueTasks);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary rounded-lg">
                <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">My Tasks</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Manage your inspection subtasks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <Button
                onClick={() => setAddTaskDialogOpen(true)}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Task</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button
                variant={showAllTasks ? "default" : "outline"}
                onClick={() => setShowAllTasks(!showAllTasks)}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                {showAllTasks ? (
                  <>
                    <User className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">My Tasks</span>
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">All Tasks</span>
                  </>
                )}
              </Button>
              <Button
                variant={showCompleted ? "default" : "outline"}
                onClick={() => setShowCompleted(!showCompleted)}
                size="sm"
                className="whitespace-nowrap"
              >
                {showCompleted ? "Hide" : "Show"}
                <span className="hidden sm:inline ml-1">Completed</span>
              </Button>
              <Button variant="outline" size="icon" onClick={handleSignOut} className="flex-shrink-0">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading tasks...</p>
        ) : (
          <div className="space-y-8">
            {/* Global Inventory Summary */}
            {(() => {
              const allFailedTasks = tasks.filter(t => t.status === 'fail' && t.inventory_type_id);
              const globalItemsByType: Record<string, number> = {};
              let globalTotalItemsNeeded = 0;
              
              allFailedTasks.forEach(task => {
                if (task.inventory_type_id && task.inventory_quantity) {
                  globalItemsByType[task.inventory_type_id] = (globalItemsByType[task.inventory_type_id] || 0) + task.inventory_quantity;
                  globalTotalItemsNeeded += task.inventory_quantity;
                }
              });

              if (globalTotalItemsNeeded === 0) return null;

              return (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="inventory" className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-destructive" />
                        <span className="font-semibold text-base">Total Items Needed</span>
                        <Badge variant="destructive" className="ml-2">{globalTotalItemsNeeded}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 space-y-2">
                        {Object.entries(globalItemsByType)
                          .sort(([, a], [, b]) => b - a)
                          .map(([typeId, qty]) => {
                            const type = inventoryTypes.find(t => t.id === typeId);
                            if (!type) return null;
                            return (
                              <div key={typeId} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                                <span className="font-medium">{type.name}</span>
                                <Badge variant="outline" className="text-destructive border-destructive">{qty}</Badge>
                              </div>
                            );
                          })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })()}

            {/* Upcoming Tasks */}
            {groupedUpcoming.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Upcoming Tasks</h2>
                <div className="space-y-6">
                   {groupedUpcoming.map((group) => {
                      // Calculate inventory needed
                      const failedTasks = group.tasks.filter(t => t.status === 'fail' && t.inventory_type_id);
                      const itemsByType: Record<string, number> = {};
                      let totalItemsNeeded = 0;
                      failedTasks.forEach(task => {
                        if (task.inventory_type_id && task.inventory_quantity) {
                          itemsByType[task.inventory_type_id] = (itemsByType[task.inventory_type_id] || 0) + task.inventory_quantity;
                          totalItemsNeeded += task.inventory_quantity;
                        }
                      });

                      return (
                        <div key={group.inspection.id} className="space-y-2">
                          {/* Inspection Header */}
                          <div className="flex flex-col gap-2 pb-2 border-b">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`${getInspectionColor(group.inspection.type)} text-white text-xs`}>
                                {group.inspection.type}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span>{format(parseISO(group.inspection.date), "MMM d, yyyy")} at {group.inspection.time}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span>{group.inspection.properties.name}</span>
                              </div>
                            </div>
                            
                            {/* Inventory Summary */}
                            {totalItemsNeeded > 0 && (
                              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-xs">
                                <div className="font-semibold text-destructive mb-1">Items Needed: {totalItemsNeeded}</div>
                                <div className="space-y-0.5 pl-2">
                                  {Object.entries(itemsByType).map(([typeId, qty]) => {
                                    const type = inventoryTypes.find(t => t.id === typeId);
                                    if (!type) return null;
                                    return (
                                      <div key={typeId} className="flex justify-between">
                                        <span className="text-muted-foreground">{type.name}</span>
                                        <span className="font-semibold text-destructive">{qty}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tasks for this inspection */}
                          <div className="space-y-1.5 ml-2">
                            {group.tasks.map((task) => {
                              const isPass = task.status === 'pass';
                              const isFail = task.status === 'fail';

                              return (
                                <Card 
                                  key={task.id} 
                                  className={`p-2 transition-colors ${
                                    isPass ? 'bg-green-50 dark:bg-green-950/20 border-green-200' :
                                    isFail ? 'bg-destructive/5 border-destructive/30' :
                                    'hover:bg-accent/50'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium flex-1">{task.description}</p>
                                        <div className="flex gap-1 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant={isPass ? "default" : "outline"}
                                            className={`h-6 px-2 ${isPass ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'pass'); }}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={isFail ? "destructive" : "outline"}
                                            className="h-6 px-2"
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'fail'); }}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 flex-wrap text-xs">
                                        {task.room_name && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{task.room_name}</Badge>
                                        )}
                                        {task.assignedProfiles && task.assignedProfiles.length > 0 && (
                                          <div className="flex items-center gap-1">
                                            {task.assignedProfiles.slice(0, 2).map((profile, idx) => (
                                              <UserAvatar
                                                key={idx}
                                                avatarUrl={profile.avatar_url}
                                                name={profile.full_name}
                                                email={profile.email}
                                                size="sm"
                                              />
                                            ))}
                                            {task.assignedProfiles.length > 2 && (
                                              <span className="text-muted-foreground">+{task.assignedProfiles.length - 2}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Display notes */}
                                      {task.activities && task.activities.length > 0 && (
                                        <div className="space-y-1 pt-1 border-t">
                                          {task.activities.map((activity) => (
                                            <div key={activity.id} className="flex items-start gap-1 text-xs">
                                              <FileText className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                              <div className="flex-1">
                                                <p className="text-muted-foreground">{activity.notes}</p>
                                                <p className="text-[10px] text-muted-foreground/70">
                                                  {activity.profiles?.full_name || activity.profiles?.email} • {format(parseISO(activity.created_at), "MMM d, h:mm a")}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Overdue Tasks */}
            {groupedOverdue.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 text-destructive">
                  Overdue Tasks
                </h2>
                <div className="space-y-6">
                  {groupedOverdue.map((group) => {
                      // Calculate inventory needed
                      const failedTasks = group.tasks.filter(t => t.status === 'fail' && t.inventory_type_id);
                      const itemsByType: Record<string, number> = {};
                      let totalItemsNeeded = 0;
                      failedTasks.forEach(task => {
                        if (task.inventory_type_id && task.inventory_quantity) {
                          itemsByType[task.inventory_type_id] = (itemsByType[task.inventory_type_id] || 0) + task.inventory_quantity;
                          totalItemsNeeded += task.inventory_quantity;
                        }
                      });

                      return (
                        <div key={group.inspection.id} className="space-y-2">
                          {/* Inspection Header */}
                          <div className="flex flex-col gap-2 pb-2 border-b border-destructive/30">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`${getInspectionColor(group.inspection.type)} text-white text-xs`}>
                                {group.inspection.type}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-destructive">
                                <Calendar className="h-3 w-3" />
                                <span>{format(parseISO(group.inspection.date), "MMM d, yyyy")} at {group.inspection.time}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span>{group.inspection.properties.name}</span>
                              </div>
                            </div>
                            
                            {/* Inventory Summary */}
                            {totalItemsNeeded > 0 && (
                              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-xs">
                                <div className="font-semibold text-destructive mb-1">Items Needed: {totalItemsNeeded}</div>
                                <div className="space-y-0.5 pl-2">
                                  {Object.entries(itemsByType).map(([typeId, qty]) => {
                                    const type = inventoryTypes.find(t => t.id === typeId);
                                    if (!type) return null;
                                    return (
                                      <div key={typeId} className="flex justify-between">
                                        <span className="text-muted-foreground">{type.name}</span>
                                        <span className="font-semibold text-destructive">{qty}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tasks for this inspection */}
                          <div className="space-y-1.5 ml-2">
                            {group.tasks.map((task) => {
                              const isPass = task.status === 'pass';
                              const isFail = task.status === 'fail';

                              return (
                                <Card 
                                  key={task.id} 
                                  className={`p-2 transition-colors ${
                                    isPass ? 'bg-green-50 dark:bg-green-950/20 border-green-200' :
                                    isFail ? 'bg-destructive/5 border-destructive/30' :
                                    'hover:bg-accent/50'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className={`text-sm font-medium flex-1 ${isFail ? 'text-destructive' : ''}`}>
                                          {task.description}
                                        </p>
                                        <div className="flex gap-1 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant={isPass ? "default" : "outline"}
                                            className={`h-6 px-2 ${isPass ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'pass'); }}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={isFail ? "destructive" : "outline"}
                                            className="h-6 px-2"
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'fail'); }}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 flex-wrap text-xs">
                                        {task.room_name && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{task.room_name}</Badge>
                                        )}
                                        {task.assignedProfiles && task.assignedProfiles.length > 0 && (
                                          <div className="flex items-center gap-1">
                                            {task.assignedProfiles.slice(0, 2).map((profile, idx) => (
                                              <UserAvatar
                                                key={idx}
                                                avatarUrl={profile.avatar_url}
                                                name={profile.full_name}
                                                email={profile.email}
                                                size="sm"
                                              />
                                            ))}
                                            {task.assignedProfiles.length > 2 && (
                                              <span className="text-muted-foreground">+{task.assignedProfiles.length - 2}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Display notes */}
                                      {task.activities && task.activities.length > 0 && (
                                        <div className="space-y-1 pt-1 border-t">
                                          {task.activities.map((activity) => (
                                            <div key={activity.id} className="flex items-start gap-1 text-xs">
                                              <FileText className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                              <div className="flex-1">
                                                <p className="text-muted-foreground">{activity.notes}</p>
                                                <p className="text-[10px] text-muted-foreground/70">
                                                  {activity.profiles?.full_name || activity.profiles?.email} • {format(parseISO(activity.created_at), "MMM d, h:mm a")}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {groupedUpcoming.length === 0 && groupedOverdue.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {showAllTasks
                    ? "No incomplete tasks found"
                    : "You have no assigned tasks"}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {editingTaskId && (
        <EditSubtaskDialog
          subtaskId={editingTaskId}
          open={!!editingTaskId}
          onOpenChange={(open) => !open && setEditingTaskId(null)}
          onSaved={fetchTasks}
        />
      )}

      <AddTaskDialog
        open={addTaskDialogOpen}
        onOpenChange={setAddTaskDialogOpen}
        onAdd={handleAddTask}
        inventoryTypes={inventoryTypes}
        onCreateInventoryType={handleCreateInventoryType}
      />

      {/* Fail Confirmation Dialog */}
      <Dialog open={!!pendingFailSubtask} onOpenChange={(open) => !open && handleFailDialogCancel()}>
        <DialogContent 
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Mark Task as Failed</DialogTitle>
            <DialogDescription>
              Please provide details about why this task failed and assign someone to address it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Select value={failDialogAssignee} onValueChange={setFailDialogAssignee}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pendingFailSubtask && tasks.find(s => s.id === pendingFailSubtask)?.inventory_type_id && (
              <div>
                <label className="text-sm font-medium">
                  Quantity Needed ({inventoryTypes.find(t => t.id === tasks.find(s => s.id === pendingFailSubtask)?.inventory_type_id)?.name})
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
                placeholder="Explain why this task failed and what needs to be done..."
                className="mt-1 min-h-[100px]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleFailDialogCancel}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleFailDialogSubmit}>
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
