import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  properties: {
    name: string;
    address: string;
  };
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface AddTaskDialogProps {
  onTaskAdded: () => void;
}

export default function AddTaskDialog({ onTaskAdded }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchInspections();
      fetchUsers();
    }
  }, [open]);

  const fetchInspections = async () => {
    const { data, error } = await supabase
      .from("inspections")
      .select(`
        id,
        type,
        date,
        time,
        properties (
          name,
          address
        )
      `)
      .order("date", { ascending: true });

    if (!error && data) {
      setInspections(data);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("full_name", { ascending: true });

    if (!error && data) {
      setUsers(data);
    }
  };

  const handleCreate = async () => {
    if (!description.trim() || !selectedInspectionId) {
      toast.error("Please enter a description and select an inspection");
      return;
    }

    setIsCreating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("subtasks").insert({
        inspection_id: selectedInspectionId,
        original_inspection_id: selectedInspectionId,
        description: description.trim(),
        assigned_users: selectedUsers.length > 0 ? selectedUsers : [user.id],
        inventory_quantity: null,
        inventory_type_id: null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Task added successfully");
      setOpen(false);
      resetForm();
      onTaskAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add task");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setSelectedInspectionId("");
    setSelectedUsers([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new subtask and assign it to an inspection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Task Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspection">Associated Inspection</Label>
            <Select
              value={selectedInspectionId}
              onValueChange={setSelectedInspectionId}
            >
              <SelectTrigger id="inspection">
                <SelectValue placeholder="Select inspection" />
              </SelectTrigger>
              <SelectContent>
                {inspections.map((inspection) => (
                  <SelectItem key={inspection.id} value={inspection.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{inspection.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {inspection.properties.name} -{" "}
                        {format(new Date(inspection.date), "MMM d, yyyy")} at{" "}
                        {inspection.time}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign Users (Optional)</Label>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {user.full_name || user.email}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to assign to yourself
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Adding..." : "Add Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
