import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { FileText, Clock, MapPin, Check, Upload, Send, Trash2, User, X, Plus, Link2, ClipboardList } from "lucide-react";
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
  inventory_quantity?: number;
  inventory_type_id?: string | null;
  created_at: string;
  created_by: string;
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
      fetchInventoryTypes();
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
            .single();

          creatorProfile = profile;
        }

        return { 
          ...subtask, 
          assignedProfiles,
          creatorProfile
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

  if (!inspection) return null;

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <div className="p-6 pb-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Inspection Details
              </DialogTitle>
              <DialogDescription>
                View inspection information and manage subtasks
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 overflow-y-auto px-6 pb-6 flex-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <Badge className={`${getInspectionColor(inspection.type)} text-white`}>
                  {inspection.type}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateSelector(true)}
                    className="gap-2"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Start Inspection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFollowUpDialog(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Follow-up
                  </Button>
                </div>
              </div>

              {(totalItemsNeeded > 0 || Object.keys(completedItemsByType).length > 0) && (
                <div className="mb-4 p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-lg shadow-sm">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Inventory Items Summary
                  </h3>
                  
                  {totalItemsNeeded > 0 && (
                    <div className="mb-3 pb-3 border-b border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">Items Still Needed:</span>
                        <span className="font-bold text-xl text-primary">{totalItemsNeeded}</span>
                      </div>
                      {Object.keys(itemsByType).length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {Array.from(allInventoryTypeIds).map((typeId) => {
                            const type = inventoryTypes.find(t => t.id === typeId);
                            const neededQty = itemsByType[typeId] || 0;
                            const completedQty = completedItemsByType[typeId] || 0;
                            const totalQty = neededQty + completedQty;
                            
                            if (!type || totalQty === 0) return null;
                            
                            return (
                              <div key={typeId} className="flex items-center justify-between text-sm bg-background/50 rounded px-3 py-2">
                                <div className="flex-1">
                                  <span className="font-medium">{type.name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  {neededQty > 0 && (
                                    <span className="text-primary font-semibold">
                                      {neededQty} needed
                                    </span>
                                  )}
                                  {completedQty > 0 && (
                                    <span className="text-green-600 font-semibold">
                                      {completedQty} completed
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">
                                    (Total: {totalQty})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {Object.keys(completedItemsByType).length > 0 && totalItemsNeeded === 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-5 w-5" />
                      <span className="font-semibold">All inventory items completed!</span>
                    </div>
                  )}
                </div>
              )}

              {inspection.parent_inspection_id && parentInspection && (
                <div className="flex items-center gap-2 text-sm mb-3 p-2 bg-accent/30 rounded-md border">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Follow-up of:</span>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-medium"
                    onClick={() => {
                      const parentId = inspection.parent_inspection_id;
                      if (parentId) {
                        onOpenChange(false);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openInspectionDetails', { 
                            detail: { inspectionId: parentId } 
                          }));
                        }, 100);
                      }
                    }}
                  >
                    {parentInspection.type} ({format(new Date(parentInspection.date), "MMM d, yyyy")})
                  </Button>
                </div>
              )}

              {childInspections.length > 0 && (
                <div className="mb-3 p-2 bg-accent/30 rounded-md border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span>Follow-up inspections:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-6">
                    {childInspections.map((child) => (
                      <Button
                        key={child.id}
                        variant="outline"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs"
                        onClick={() => {
                          onOpenChange(false);
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('openInspectionDetails', { 
                              detail: { inspectionId: child.id } 
                            }));
                          }, 100);
                        }}
                      >
                        {child.type} ({format(new Date(child.date), "MMM d, yyyy")})
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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
                    {inspection.units && (
                      <div className="text-muted-foreground text-xs mt-1">
                        Unit: {inspection.units.name}
                      </div>
                    )}
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
                <span className="text-xs text-muted-foreground">
                  {subtasks.filter(s => s.original_inspection_id === inspectionId).length} original • {subtasks.filter(s => s.original_inspection_id !== inspectionId).length} inherited
                </span>
              </div>

              <div className="space-y-3">
                {subtasks.map((subtask) => {
                  const isInherited = subtask.original_inspection_id !== inspectionId;
                  
                  return (
                  <div
                    key={subtask.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg transition-colors group ${
                      subtask.completed
                        ? "bg-muted/30 opacity-60"
                        : isInherited
                        ? "bg-accent/20 hover:bg-accent/30"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={subtask.completed}
                      onCheckedChange={() =>
                        toggleSubtaskComplete(subtask.id, subtask.completed)
                      }
                      className="mt-1"
                    />
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={`text-sm flex-1 ${
                              subtask.completed ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {subtask.description}
                          </p>
                          {isInherited && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              Inherited
                            </Badge>
                          )}
                        </div>
                        {subtask.inventory_quantity && subtask.inventory_quantity > 0 && (
                          <p className={`text-xs mt-1 ${
                            subtask.completed ? "text-muted-foreground/60" : "text-primary font-medium"
                          }`}>
                            Items needed: {subtask.inventory_quantity}
                            {subtask.inventory_type_id && inventoryTypes.find(t => t.id === subtask.inventory_type_id)?.name && (
                              <> {inventoryTypes.find(t => t.id === subtask.inventory_type_id)?.name}</>
                            )}
                          </p>
                        )}
                        {subtask.assignedProfiles && subtask.assignedProfiles.length > 0 && (
                          <div className={`flex items-center gap-2 mt-1 ${
                            subtask.completed ? "text-muted-foreground/60" : "text-muted-foreground"
                          }`}>
                            <div className="flex items-center gap-1">
                              {subtask.assignedProfiles.map((profile, idx) => (
                                <UserAvatar
                                  key={idx}
                                  avatarUrl={profile.avatar_url}
                                  name={profile.full_name}
                                  email={profile.email}
                                  size="sm"
                                />
                              ))}
                            </div>
                            <p className="text-xs">
                              {subtask.assignedProfiles
                                .map((p) => p.full_name || p.email)
                                .join(", ")}
                            </p>
                          </div>
                        )}
                        {subtask.creatorProfile && (
                          <div className={`flex items-center gap-2 mt-1 text-xs ${
                            subtask.completed ? "text-muted-foreground/60" : "text-muted-foreground"
                          }`}>
                            <Clock className="h-3 w-3" />
                            <span>
                              Added by {subtask.creatorProfile.full_name || subtask.creatorProfile.email} 
                              {' • '}
                              {formatDistanceToNow(new Date(subtask.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      {subtask.attachment_url && (
                        <a
                          href={subtask.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs hover:underline mt-1 block ${
                            subtask.completed ? "text-muted-foreground/60" : "text-primary"
                          }`}
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {subtask.completed && <Check className="h-4 w-4 text-muted-foreground" />}
                      {!isInherited && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteSubtask(subtask.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
                })}

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
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {newAssignedUsers.length === 0 ? (
                                "No one assigned"
                              ) : (
                                <span className="text-foreground">
                                  {newAssignedUsers.map((userId, index) => {
                                    const user = users.find((u) => u.id === userId);
                                    return (
                                      <span key={userId} className="inline-flex items-center">
                                        {user?.full_name || user?.email}
                                        <button
                                          onClick={() =>
                                            setNewAssignedUsers(
                                              newAssignedUsers.filter((id) => id !== userId)
                                            )
                                          }
                                          className="ml-1 hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                        {index < newAssignedUsers.length - 1 && ", "}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </span>
                          </div>
                          <Select
                            value=""
                            onValueChange={(userId) => {
                              if (!newAssignedUsers.includes(userId)) {
                                setNewAssignedUsers([...newAssignedUsers, userId]);
                              }
                            }}
                          >
                            <SelectTrigger className="bg-background h-9">
                              <SelectValue placeholder="+ Add assignee" />
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

      {inspection && (
        <>
          <AddFollowUpDialog
            parentInspection={{
              id: inspection.id,
              type: inspection.type,
              property_id: inspection.property_id,
              unit_id: inspection.unit_id,
            }}
            open={showFollowUpDialog}
            onOpenChange={setShowFollowUpDialog}
            onSuccess={() => {
              fetchInspectionDetails();
              fetchSubtasks();
            }}
          />

          <StartInspectionDialog
            open={showTemplateSelector}
            onOpenChange={setShowTemplateSelector}
            inspectionType={inspection.type}
            inspectionId={inspection.id}
            onInspectionStarted={fetchSubtasks}
          />
        </>
      )}
    </>
  );
}
