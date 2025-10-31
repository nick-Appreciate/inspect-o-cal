import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, LogOut, Calendar, MapPin, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import AddTaskDialog from "@/components/AddTaskDialog";

interface SubtaskWithInspection {
  id: string;
  description: string;
  completed: boolean;
  attachment_url?: string;
  assigned_users?: string[];
  inspection_id: string;
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
  }>;
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
  const [loading, setLoading] = useState(true);

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
    }
  }, [user, showAllTasks]);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
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
      `)
      .eq("completed", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
      setLoading(false);
      return;
    }

    // Fetch profiles for assigned users
    const tasksWithProfiles = await Promise.all(
      (data || []).map(async (task) => {
        if (task.assigned_users && task.assigned_users.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("full_name, email")
            .in("id", task.assigned_users);

          return { ...task, assignedProfiles: profiles || [] };
        }
        return task;
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

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("subtasks")
      .update({ completed: !completed })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update task");
    } else {
      fetchTasks();
    }
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
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <ClipboardCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Tasks</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your inspection subtasks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AddTaskDialog onTaskAdded={fetchTasks} />
              <Button
                variant="outline"
                onClick={() => navigate("/")}
              >
                Calendar View
              </Button>
              <Button
                variant={showAllTasks ? "default" : "outline"}
                onClick={() => setShowAllTasks(!showAllTasks)}
              >
                {showAllTasks ? (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    My Tasks
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    All Tasks
                  </>
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
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
            {/* Upcoming Tasks */}
            {groupedUpcoming.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Upcoming Tasks</h2>
                <div className="space-y-6">
                  {groupedUpcoming.map((group) => (
                    <div key={group.inspection.id} className="space-y-3">
                      {/* Inspection Header */}
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <Badge
                          className={`${getInspectionColor(
                            group.inspection.type
                          )} text-white`}
                        >
                          {group.inspection.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(parseISO(group.inspection.date), "MMM d, yyyy")} at{" "}
                            {group.inspection.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{group.inspection.properties.name}</span>
                        </div>
                      </div>

                      {/* Tasks for this inspection */}
                      <div className="space-y-2 ml-4">
                        {group.tasks.map((task) => (
                          <Card key={task.id} className="p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={task.completed}
                                onCheckedChange={() =>
                                  handleToggleComplete(task.id, task.completed)
                                }
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">{task.description}</p>

                                {task.assignedProfiles && task.assignedProfiles.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>
                                      {task.assignedProfiles
                                        .map((p) => p.full_name || p.email)
                                        .join(", ")}
                                    </span>
                                  </div>
                                )}

                                {task.attachment_url && (
                                  <a
                                    href={task.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View Attachment
                                  </a>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
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
                  {groupedOverdue.map((group) => (
                    <div key={group.inspection.id} className="space-y-3">
                      {/* Inspection Header */}
                      <div className="flex items-center gap-3 pb-2 border-b border-destructive/30">
                        <Badge
                          className={`${getInspectionColor(
                            group.inspection.type
                          )} text-white`}
                        >
                          {group.inspection.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(parseISO(group.inspection.date), "MMM d, yyyy")} at{" "}
                            {group.inspection.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{group.inspection.properties.name}</span>
                        </div>
                      </div>

                      {/* Tasks for this inspection */}
                      <div className="space-y-2 ml-4">
                        {group.tasks.map((task) => (
                          <Card
                            key={task.id}
                            className="p-3 border-destructive bg-destructive/5"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={task.completed}
                                onCheckedChange={() =>
                                  handleToggleComplete(task.id, task.completed)
                                }
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium text-destructive">
                                  {task.description}
                                </p>

                                {task.assignedProfiles && task.assignedProfiles.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>
                                      {task.assignedProfiles
                                        .map((p) => p.full_name || p.email)
                                        .join(", ")}
                                    </span>
                                  </div>
                                )}

                                {task.attachment_url && (
                                  <a
                                    href={task.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View Attachment
                                  </a>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}
