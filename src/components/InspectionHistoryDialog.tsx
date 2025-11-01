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
import { Calendar, Clock, CheckCircle2, XCircle, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface HistoricalInspection {
  id: string;
  date: string;
  time: string;
  type: string;
  completed: boolean;
  property_name: string;
  unit_name?: string;
  subtasks: Array<{
    id: string;
    description: string;
    status: string;
    room_name: string | null;
    assigned_users: string[];
    created_at: string;
  }>;
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
        .single();

      if (currentError) throw currentError;

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

      // Fetch subtasks for each completed inspection
      const historyWithSubtasks: HistoricalInspection[] = [];
      
      for (const inspection of inspections || []) {
        const { data: subtasks, error: subtasksError } = await supabase
          .from("subtasks")
          .select("id, description, status, room_name, assigned_users, created_at")
          .eq("inspection_id", inspection.id)
          .order("created_at", { ascending: true });

        if (!subtasksError && subtasks) {
          historyWithSubtasks.push({
            id: inspection.id,
            date: inspection.date,
            time: inspection.time,
            type: inspection.type,
            completed: inspection.completed,
            property_name: inspection.properties.name,
            unit_name: inspection.units?.name,
            subtasks: subtasks,
          });
        }
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
          <DialogTitle>Inspection History</DialogTitle>
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
                    <div className="space-y-1">
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
                    </div>
                  </div>

                  {inspection.subtasks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-sm font-medium">
                        Issues Found ({inspection.subtasks.length})
                      </h4>
                      <div className="space-y-2">
                        {inspection.subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="border rounded p-3 space-y-2 bg-muted/30"
                          >
                            <div className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">{subtask.description}</p>
                                {subtask.room_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Room: {subtask.room_name}
                                  </p>
                                )}
                                {subtask.assigned_users && subtask.assigned_users.length > 0 && (
                                  <div className="flex items-center gap-1 mt-2 flex-wrap">
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
                          </div>
                        ))}
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
