import { useState, useEffect } from "react";
import { format } from "date-fns";
import { FileText, Clock, MapPin, Plus, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddSubtaskDialog from "./AddSubtaskDialog";

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  property_id: string;
  attachment_url?: string;
  properties: {
    name: string;
    address: string;
  };
}

interface Subtask {
  id: string;
  description: string;
  completed: boolean;
  attachment_url?: string;
  assigned_to?: string;
  profiles?: {
    full_name: string;
    email: string;
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
  const [addSubtaskOpen, setAddSubtaskOpen] = useState(false);

  useEffect(() => {
    if (inspectionId && open) {
      fetchInspectionDetails();
      fetchSubtasks();
    }
  }, [inspectionId, open]);

  const fetchInspectionDetails = async () => {
    if (!inspectionId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("inspections")
      .select("*, properties(name, address)")
      .eq("id", inspectionId)
      .single();

    if (error) {
      toast.error("Failed to load inspection details");
    } else {
      setInspection(data);
    }
    setLoading(false);
  };

  const fetchSubtasks = async () => {
    if (!inspectionId) return;

    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load subtasks:", error);
      return;
    }

    // Fetch profiles for assigned users
    const subtasksWithProfiles = await Promise.all(
      (data || []).map(async (subtask) => {
        if (subtask.assigned_to) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", subtask.assigned_to)
            .single();

          return { ...subtask, profiles: profile };
        }
        return subtask;
      })
    );

    setSubtasks(subtasksWithProfiles);
  };

  const toggleSubtaskComplete = async (subtaskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("subtasks")
      .update({ completed: !completed })
      .eq("id", subtaskId);

    if (error) {
      toast.error("Failed to update subtask");
    } else {
      fetchSubtasks();
    }
  };

  const handleSubtaskAdded = () => {
    fetchSubtasks();
    setAddSubtaskOpen(false);
  };

  if (!inspection) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Inspection Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Badge className={`${getInspectionColor(inspection.type)} text-white mb-4`}>
                {inspection.type}
              </Badge>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(inspection.date), "MMMM d, yyyy")} at {inspection.time}
                  </span>
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">{inspection.properties.name}</div>
                    <div className="text-muted-foreground">{inspection.properties.address}</div>
                  </div>
                </div>

                {inspection.attachment_url && (
                  <div className="pt-2">
                    <a
                      href={inspection.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      View Attachment
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Subtasks</h3>
                <Button size="sm" onClick={() => setAddSubtaskOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Subtask
                </Button>
              </div>

              {subtasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No subtasks yet. Click "Add Subtask" to create one.
                </p>
              ) : (
                <div className="space-y-3">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={() =>
                          toggleSubtaskComplete(subtask.id, subtask.completed)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm ${
                            subtask.completed ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {subtask.description}
                        </p>
                        {subtask.profiles && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned to: {subtask.profiles.full_name || subtask.profiles.email}
                          </p>
                        )}
                        {subtask.attachment_url && (
                          <a
                            href={subtask.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 block"
                          >
                            View Attachment
                          </a>
                        )}
                      </div>
                      {subtask.completed && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddSubtaskDialog
        inspectionId={inspectionId}
        open={addSubtaskOpen}
        onOpenChange={setAddSubtaskOpen}
        onSubtaskAdded={handleSubtaskAdded}
      />
    </>
  );
}
