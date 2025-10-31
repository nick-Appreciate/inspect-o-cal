import { useState, useEffect } from "react";
import { Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface EditSubtaskDialogProps {
  subtaskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function EditSubtaskDialog({
  subtaskId,
  open,
  onOpenChange,
  onSaved,
}: EditSubtaskDialogProps) {
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [originalInspectionId, setOriginalInspectionId] = useState("");

  useEffect(() => {
    if (open && subtaskId) {
      fetchSubtask();
      fetchUsers();
    }
  }, [open, subtaskId]);

  const fetchSubtask = async () => {
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("id", subtaskId)
      .single();

    if (!error && data) {
      setDescription(data.description);
      setSelectedUsers(data.assigned_users || []);
      setOriginalInspectionId(data.original_inspection_id);
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

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsSaving(true);

    try {
      // Update all subtasks with the same original_inspection_id and description
      // This ensures that linked subtasks stay in sync
      const { data: relatedSubtasks } = await supabase
        .from("subtasks")
        .select("id")
        .eq("original_inspection_id", originalInspectionId)
        .eq("id", subtaskId); // Only update this specific subtask

      const { error } = await supabase
        .from("subtasks")
        .update({
          description: description.trim(),
          assigned_users: selectedUsers,
        })
        .eq("id", subtaskId);

      if (error) throw error;

      toast.success("Task updated successfully");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Task
          </DialogTitle>
          <DialogDescription>
            Make changes to this task
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Task Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description..."
            />
          </div>

          <div className="space-y-2">
            <Label>Assigned Users</Label>
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
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
