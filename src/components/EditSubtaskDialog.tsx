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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface InventoryType {
  id: string;
  name: string;
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
  const [inventoryQuantity, setInventoryQuantity] = useState<number>(0);
  const [inventoryTypeId, setInventoryTypeId] = useState<string>("");
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);

  useEffect(() => {
    if (open && subtaskId) {
      fetchSubtask();
      fetchUsers();
      fetchInventoryTypes();
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
      setInventoryQuantity(data.inventory_quantity || 0);
      setInventoryTypeId(data.inventory_type_id || "none");
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

  const fetchInventoryTypes = async () => {
    const { data, error } = await supabase
      .from("inventory_types")
      .select("*")
      .order("name");

    if (!error && data) {
      setInventoryTypes(data);
    }
  };

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("subtasks")
        .update({
          description: description.trim(),
          assigned_users: selectedUsers.length > 0 ? selectedUsers : null,
          inventory_quantity: inventoryQuantity > 0 ? inventoryQuantity : null,
          inventory_type_id: inventoryTypeId && inventoryTypeId !== "none" ? inventoryTypeId : null,
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
            <Label>Assigned Users (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select one or more users to assign to this task
            </p>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No users available
                </p>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-input"
                    />
                    <span className="text-sm flex-1">
                      {user.full_name || user.email}
                    </span>
                    {selectedUsers.includes(user.id) && (
                      <Badge variant="secondary" className="text-xs">
                        Assigned
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedUsers.length === 0 
                ? "No users assigned" 
                : `${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'} assigned`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Inventory Items (Optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={inventoryQuantity}
                  onChange={(e) => setInventoryQuantity(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={inventoryTypeId} onValueChange={setInventoryTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">None</SelectItem>
                    {inventoryTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
