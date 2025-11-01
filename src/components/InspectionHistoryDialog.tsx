import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle2, XCircle, User, ArrowRight, Circle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SubtaskWithStatus {
  id: string;
  description: string;
  room_name: string | null;
  assigned_users: string[];
  created_at: string;
  initial_status: 'bad' | 'good';
  initial_completed: boolean;
  current_status: 'bad' | 'good';
  current_completed: boolean;
  status_changed: boolean;
}

interface HistoricalInspection {
  id: string;
  date: string;
  time: string;
  type: string;
  completed: boolean;
  completed_by?: string;
  property_name: string;
  unit_name?: string;
  subtasks: SubtaskWithStatus[];
  completedByProfile?: {
    full_name: string | null;
    email: string;
  };
}

interface InspectionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  propertyId?: string;
  unitId?: string;
}

export function InspectionHistoryDialog({
  open,
  onOpenChange,
  inspectionId,
  propertyId,
  unitId,
}: InspectionHistoryDialogProps) {
  const [history, setHistory] = useState<HistoricalInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Record<string, { full_name: string | null }>>({});
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => {
    if (open) {
      fetchHistory();
      fetchUsers();
    }
  }, [open, inspectionId, propertyId, unitId]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id, full_name");

    if (!error && data) {
      const userMap: Record<string, { full_name: string | null }> = {};
      data.forEach((user) => {
        if (user.id) {
          userMap[user.id] = { full_name: user.full_name };
        }
      });
      setUsers(userMap);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // First, get the current inspection to determine property/unit
      const { data: currentInspection, error: currentError } = await supabase
        .from("inspections")
        .select("property_id, unit_id")
        .eq("id", inspectionId)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!currentInspection) {
        setLoading(false);
        return;
      }

      const targetPropertyId = propertyId || currentInspection.property_id;
      const targetUnitId = unitId || currentInspection.unit_id;

      // Fetch all completed inspections for the same property/unit
      let query = supabase
        .from("inspections")
        .select(`
          id,
          date,
          time,
          type,
          completed,
          completed_by,
          properties!inner(name),
          units(name)
        `)
        .eq("completed", true)
        .eq("property_id", targetPropertyId)
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (targetUnitId) {
        query = query.eq("unit_id", targetUnitId);
      } else {
        query = query.is("unit_id", null);
      }

      const { data: inspections, error: inspectionsError } = await query;

      if (inspectionsError) throw inspectionsError;

      // Fetch all subtasks for the property/unit to build status map
      let subtasksQuery = supabase
        .from("subtasks")
        .select("id, description, status, completed, room_name, assigned_users, created_at, original_inspection_id, inspection_id, inspection_run_id");

      const { data: allSubtasks, error: allSubtasksError } = await subtasksQuery;
      
      if (allSubtasksError) throw allSubtasksError;

      // Build a map of original_inspection_id -> latest status for each issue
      const subtaskStatusMap = new Map<string, Map<string, any>>();
      
      (allSubtasks || []).forEach(subtask => {
        if (!subtaskStatusMap.has(subtask.original_inspection_id)) {
          subtaskStatusMap.set(subtask.original_inspection_id, new Map());
        }
        const inspectionMap = subtaskStatusMap.get(subtask.original_inspection_id)!;
        
        // Use description as key to track same issue across inspections
        const key = `${subtask.room_name || 'no-room'}-${subtask.description}`;
        inspectionMap.set(key, subtask);
      });

      // Build history with initial vs current comparison
      const historyWithSubtasks: HistoricalInspection[] = [];
      
      for (const inspection of inspections || []) {
        // Get initial subtasks created in this inspection
        const initialSubtasks = (allSubtasks || []).filter(
          st => st.original_inspection_id === inspection.id
        );

        const subtasksWithStatus: SubtaskWithStatus[] = initialSubtasks
          .filter(initial => {
            // Only show items that were part of an inspection run (have inspection_run_id)
            // This excludes manually created items
            if (!initial.inspection_run_id) return false;
            
            // If showAllItems is false, only show problems (bad status)
            if (!showAllItems && initial.status !== 'bad') return false;
            
            return true;
          })
          .map(initial => {
          const key = `${initial.room_name || 'no-room'}-${initial.description}`;
          
          // Find latest status of this issue across all inspections
          let currentStatus = initial;
          for (const insp of inspections || []) {
            const inspMap = subtaskStatusMap.get(insp.id);
            if (inspMap && inspMap.has(key)) {
              const candidate = inspMap.get(key);
              if (new Date(candidate.created_at) >= new Date(currentStatus.created_at)) {
                currentStatus = candidate;
              }
            }
          }

          return {
            id: initial.id,
            description: initial.description,
            room_name: initial.room_name,
            assigned_users: initial.assigned_users || [],
            created_at: initial.created_at,
            initial_status: initial.status as 'bad' | 'good',
            initial_completed: initial.completed || false,
            current_status: currentStatus.status as 'bad' | 'good',
            current_completed: currentStatus.completed || false,
            status_changed: initial.completed !== currentStatus.completed || initial.status !== currentStatus.status,
          };
        });

        // Fetch completed by profile if exists
        let completedByProfile = undefined;
        if (inspection.completed_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", inspection.completed_by)
            .maybeSingle();
          
          if (profile) {
            completedByProfile = profile;
          }
        }

        historyWithSubtasks.push({
          id: inspection.id,
          date: inspection.date,
          time: inspection.time,
          type: inspection.type,
          completed: inspection.completed,
          completed_by: inspection.completed_by,
          property_name: inspection.properties.name,
          unit_name: inspection.units?.name,
          subtasks: subtasksWithStatus,
          completedByProfile,
        });
      }

      setHistory(historyWithSubtasks);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load inspection history");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Inspection History</DialogTitle>
            <Button
              variant={showAllItems ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAllItems(!showAllItems)}
            >
              {showAllItems ? "Show Problems Only" : "Show All Items"}
            </Button>
          </div>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading history...</div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">No completed inspections found</div>
          </div>
        ) : (
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {history.map((inspection) => (
                <div
                  key={inspection.id}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{inspection.type}</h3>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(inspection.date), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {inspection.time}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {inspection.property_name}
                        {inspection.unit_name && ` - ${inspection.unit_name}`}
                      </div>
                      {inspection.completedByProfile && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Completed by: {inspection.completedByProfile.full_name || inspection.completedByProfile.email}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (confirm("Delete this inspection and all its data? This cannot be undone.")) {
                          const { error } = await supabase
                            .from("inspections")
                            .delete()
                            .eq("id", inspection.id);
                          
                          if (error) {
                            toast.error("Failed to delete inspection");
                          } else {
                            toast.success("Inspection deleted");
                            fetchHistory();
                          }
                        }
                      }}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>

                  {inspection.subtasks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-sm font-medium">
                        {showAllItems ? 'Items Checked' : 'Issues Found'} ({inspection.subtasks.length})
                      </h4>
                      <div className="space-y-2">
                        {inspection.subtasks.map((subtask) => {
                          const isGood = subtask.initial_status === 'good';
                          const isBad = subtask.initial_status === 'bad';
                          
                          return (
                            <div
                              key={subtask.id}
                              className={`border rounded p-3 ${
                                subtask.status_changed 
                                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' 
                                  : isGood 
                                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                                  : 'bg-muted/30'
                              }`}
                            >
                              <div className="space-y-2">
                                {/* Item Description */}
                                <div className="flex items-start gap-2">
                                  {isGood ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                  ) : isBad ? (
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">{subtask.description}</p>
                                      <Badge 
                                        variant={isGood ? "default" : isBad ? "destructive" : "outline"}
                                        className="text-xs"
                                      >
                                        {isGood ? "Good" : isBad ? "Bad" : "Unchecked"}
                                      </Badge>
                                    </div>
                                    {subtask.room_name && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Room: {subtask.room_name}
                                      </p>
                                    )}
                                  </div>
                                </div>

                              {/* Initial vs Current Status */}
                              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-xs">
                                {/* Initial Status */}
                                <div className="bg-background/60 rounded p-2">
                                  <p className="font-medium mb-1 text-muted-foreground">Initial</p>
                                  <Badge 
                                    variant={subtask.initial_completed ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {subtask.initial_completed ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Resolved
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Open
                                      </>
                                    )}
                                  </Badge>
                                </div>

                                {/* Arrow */}
                                {subtask.status_changed && (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}

                                {/* Current Status */}
                                <div className="bg-background/60 rounded p-2">
                                  <p className="font-medium mb-1 text-muted-foreground">Current</p>
                                  <Badge 
                                    variant={subtask.current_completed ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {subtask.current_completed ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Resolved
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Open
                                      </>
                                    )}
                                  </Badge>
                                </div>
                              </div>

                              {/* Assigned Users */}
                              {subtask.assigned_users && subtask.assigned_users.length > 0 && (
                                <div className="flex items-center gap-1 pt-1 flex-wrap">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {subtask.assigned_users.map((userId) => {
                                    const user = users[userId];
                                    return user ? (
                                      <Badge
                                        key={userId}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {user.full_name || "User"}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {inspection.subtasks.length === 0 && (
                    <div className="text-sm text-muted-foreground pt-2 border-t">
                      No issues found - inspection passed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
