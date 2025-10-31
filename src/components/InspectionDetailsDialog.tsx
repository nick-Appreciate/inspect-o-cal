import { useState, useEffect } from "react";
import { format } from "date-fns";
import { FileText, Clock, MapPin, Check, Upload, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
  assigned_users?: string[];
  assignedProfiles?: Array<{
    full_name: string;
    email: string;
  }>;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
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
  
  // New subtask form state
  const [newDescription, setNewDescription] = useState("");
  const [newAssignedUsers, setNewAssignedUsers] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState<File>();
  const [isAdding, setIsAdding] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);

  useEffect(() => {
    if (inspectionId && open) {
      fetchInspectionDetails();
      fetchSubtasks();
      fetchUsers();
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
        if (subtask.assigned_users && subtask.assigned_users.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("full_name, email")
            .in("id", subtask.assigned_users);

          return { ...subtask, assignedProfiles: profiles || [] };
        }
        return subtask;
      })
    );

    setSubtasks(subtasksWithProfiles);
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
        description: newDescription.trim(),
        assigned_users: newAssignedUsers.length > 0 ? newAssignedUsers : null,
        attachment_url: attachmentUrl,
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
              </div>

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
                      {subtask.assignedProfiles && subtask.assignedProfiles.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned to: {subtask.assignedProfiles
                            .map((p) => p.full_name || p.email)
                            .join(", ")}
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
                    {subtask.completed && <Check className="h-4 w-4 text-primary" />}
                  </div>
                ))}

                {/* Inline Add Subtask Form */}
                <div className="flex items-start gap-3 p-3 border rounded-lg border-dashed bg-muted/30">
                  <div className="w-5 h-5 mt-1" /> {/* Spacer for checkbox alignment */}
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="Add a new subtask..."
                      value={newDescription}
                      onChange={(e) => {
                        setNewDescription(e.target.value);
                        if (e.target.value && !showFullForm) {
                          setShowFullForm(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) {
                          handleAddSubtask();
                        }
                      }}
                      className="min-h-[60px] bg-background resize-none"
                      disabled={isAdding}
                    />

                    {(showFullForm || newDescription) && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[40px]">
                            {newAssignedUsers.length > 0 ? (
                              newAssignedUsers.map((userId) => {
                                const user = users.find((u) => u.id === userId);
                                return (
                                  <Badge
                                    key={userId}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                  >
                                    {user?.full_name || user?.email}
                                    <button
                                      onClick={() =>
                                        setNewAssignedUsers(
                                          newAssignedUsers.filter((id) => id !== userId)
                                        )
                                      }
                                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                                    >
                                      <span className="sr-only">Remove</span>
                                      <span className="text-xs">×</span>
                                    </button>
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Click to assign users
                              </span>
                            )}
                          </div>
                          <Select
                            value=""
                            onValueChange={(userId) => {
                              if (!newAssignedUsers.includes(userId)) {
                                setNewAssignedUsers([...newAssignedUsers, userId]);
                              }
                            }}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Add assignee (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {users
                                .filter((user) => !newAssignedUsers.includes(user.id))
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.full_name || user.email}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            id="new-attachment"
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("new-attachment")?.click()}
                            className="flex-1"
                          >
                            <Upload className="h-3 w-3 mr-2" />
                            {newAttachment ? newAttachment.name : "Attach file"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleAddSubtask}
                            disabled={!newDescription.trim() || isAdding}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {isAdding ? "Adding..." : "Add"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
