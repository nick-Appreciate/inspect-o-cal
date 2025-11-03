import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { UserAvatar } from "./UserAvatar";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

interface MarkFailDialogProps {
  subtaskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function MarkFailDialog({
  subtaskId,
  open,
  onOpenChange,
  onSuccess,
}: MarkFailDialogProps) {
  const [notes, setNotes] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setNotes("");
      setSelectedUser("");
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id, full_name, avatar_url")
      .order("full_name", { ascending: true });

    if (!error && data) {
      setUsers(data);
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Please enter notes explaining the failure");
      return;
    }

    if (!selectedUser) {
      toast.error("Please assign a user to handle this failure");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Update subtask status to fail and assign user
      const { error: updateError } = await supabase
        .from("subtasks")
        .update({
          status: 'fail',
          status_changed_by: user.id,
          status_changed_at: new Date().toISOString(),
          assigned_users: [selectedUser],
        })
        .eq("id", subtaskId);

      if (updateError) throw updateError;

      // Add note as activity
      const { error: activityError } = await supabase
        .from("subtask_activity")
        .insert({
          subtask_id: subtaskId,
          activity_type: 'note_added',
          notes: notes.trim(),
          created_by: user.id,
        });

      if (activityError) throw activityError;

      toast.success("Task marked as failed");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error marking task as failed:", error);
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedUserProfile = users.find(u => u.id === selectedUser);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Mark as Failed
          </DialogTitle>
          <DialogDescription>
            Document the failure and assign someone to address it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fail-notes" className="text-base font-semibold">
              What went wrong? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="fail-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the issue in detail..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Required: Explain what failed and what needs to be done.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-user" className="text-base font-semibold">
              Assign to <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="assign-user">
                <SelectValue placeholder="Select a user to handle this..." />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        avatarUrl={user.avatar_url}
                        name={user.full_name}
                        size="sm"
                      />
                      <span>{user.full_name || "Unknown User"}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUserProfile && (
              <div className="flex items-center gap-2 p-2 bg-accent rounded-md">
                <UserAvatar
                  avatarUrl={selectedUserProfile.avatar_url}
                  name={selectedUserProfile.full_name}
                  size="sm"
                />
                <span className="text-sm font-medium">
                  {selectedUserProfile.full_name || "Unknown User"}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Required: Who will fix this issue?
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSaving || !notes.trim() || !selectedUser}
          >
            {isSaving ? "Marking as Failed..." : "Mark as Failed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
