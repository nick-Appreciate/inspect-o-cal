import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InspectionType } from "@/types/inspection";

interface AddFollowUpDialogProps {
  parentInspection: {
    id: string;
    type: string;
    property_id: string;
    unit_id?: string;
    date: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const inspectionTypes: InspectionType[] = [
  "S8 - RFT",
  "S8 - 1st Annual",
  "S8 - Reinspection",
  "S8 - Abatement Cure",
  "Rental License",
  "HUD",
];

export default function AddFollowUpDialog({
  parentInspection,
  open,
  onOpenChange,
  onSuccess,
}: AddFollowUpDialogProps) {
  const [type, setType] = useState<string>(parentInspection.type);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!type || !date || !time) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate that follow-up date is not before parent inspection date
    if (date < parentInspection.date) {
      toast.error("Follow-up inspection date cannot be before the initial inspection date");
      return;
    }

    setIsCreating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the follow-up inspection
      const { data: newInspection, error } = await supabase
        .from("inspections")
        .insert({
          type,
          date,
          time,
          property_id: parentInspection.property_id,
          unit_id: parentInspection.unit_id || null,
          parent_inspection_id: parentInspection.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Copy subtasks from all parent inspections in the chain
      await copySubtasksFromChain(parentInspection.id, newInspection.id);

      toast.success("Follow-up inspection created");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to create follow-up inspection");
    } finally {
      setIsCreating(false);
    }
  };

  const copySubtasksFromChain = async (parentId: string, newInspectionId: string) => {
    /* 
     * COMPLETE REBUILD: Copy inspection_rooms and subtasks from parent chain
     * Preserves room structure and ordering exactly as in parent inspection
     */
    
    // Step 1: Fetch parent inspection_rooms
    const { data: parentInspectionRooms } = await supabase
      .from("inspection_rooms")
      .select("*")
      .eq("inspection_id", parentId)
      .order("order_index");

    if (parentInspectionRooms && parentInspectionRooms.length > 0) {
      // Create inspection_rooms for the new inspection
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newInspectionRooms = parentInspectionRooms.map(room => ({
        inspection_id: newInspectionId,
        name: room.name,
        order_index: room.order_index,
        created_by: user.id,
      }));

      const { data: createdRooms, error: roomsError } = await supabase
        .from("inspection_rooms")
        .insert(newInspectionRooms)
        .select();

      if (roomsError || !createdRooms) {
        console.error("Failed to copy inspection rooms:", roomsError);
        throw roomsError;
      }

      // Map old room IDs to new room IDs
      const roomIdMap = new Map<string, string>();
      parentInspectionRooms.forEach((oldRoom, idx) => {
        roomIdMap.set(oldRoom.id, createdRooms[idx].id);
      });

      // Step 2: Fetch and copy subtasks with full data
      const subtasks = await getAllSubtasksInChain(parentId);

      if (subtasks.length > 0) {
        const subtasksToInsert = subtasks.map((subtask) => ({
          inspection_id: newInspectionId,
          original_inspection_id: subtask.original_inspection_id,
          inspection_room_id: subtask.inspection_room_id 
            ? (roomIdMap.get(subtask.inspection_room_id) || null)
            : null,
          description: subtask.description,
          room_name: subtask.room_name,
          inventory_type_id: subtask.inventory_type_id,
          vendor_type_id: subtask.vendor_type_id,
          inventory_quantity: subtask.inventory_quantity || 0,
          order_index: subtask.order_index || 0,
          assigned_users: subtask.assigned_users,
          attachment_url: subtask.attachment_url,
          status: 'pending',
          completed: false,
          created_by: subtask.created_by,
        }));

        const { error } = await supabase.from("subtasks").insert(subtasksToInsert);
        if (error) throw error;
      }
    }
  };

  const getAllSubtasksInChain = async (inspectionId: string): Promise<any[]> => {
    // Get all subtasks that are associated with this inspection or any of its parents
    const { data: inspection } = await supabase
      .from("inspections")
      .select("parent_inspection_id")
      .eq("id", inspectionId)
      .single();

    // Get subtasks for current inspection
    const { data: subtasks } = await supabase
      .from("subtasks")
      .select("*")
      .eq("inspection_id", inspectionId);

    let allSubtasks = subtasks || [];

    // Recursively get subtasks from parent
    if (inspection?.parent_inspection_id) {
      const parentSubtasks = await getAllSubtasksInChain(
        inspection.parent_inspection_id
      );
      allSubtasks = [...allSubtasks, ...parentSubtasks];
    }

    // Remove duplicates based on original_inspection_id + description
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Follow-up Inspection
          </DialogTitle>
          <DialogDescription>
            Create a follow-up inspection that inherits all previous subtasks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Inspection Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {inspectionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              min={parentInspection.date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Follow-up must be scheduled on or after {new Date(parentInspection.date).toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Follow-up"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
