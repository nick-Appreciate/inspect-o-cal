import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "./UserAvatar";

interface VendorType {
  id: string;
  name: string;
  default_assigned_user_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function VendorTypesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeUserId, setNewTypeUserId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUserId, setEditUserId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchVendorTypes();
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id, full_name, avatar_url");

    if (error) {
      toast.error("Failed to load users");
      return;
    }

    setUsers(data || []);
  };

  const fetchVendorTypes = async () => {
    const { data, error } = await supabase
      .from("vendor_types")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load vendor types");
      return;
    }

    setVendorTypes(data || []);
  };

  const addVendorType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("vendor_types")
      .insert({
        name: newTypeName,
        created_by: user.id,
        default_assigned_user_id: newTypeUserId && newTypeUserId !== "none" ? newTypeUserId : null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add vendor type");
      return;
    }

    setVendorTypes([...vendorTypes, data]);
    setNewTypeName("");
    setNewTypeUserId("");
    toast.success("Vendor type added");
  };

  const startEdit = (vendorType: VendorType) => {
    setEditingId(vendorType.id);
    setEditName(vendorType.name);
    setEditUserId(vendorType.default_assigned_user_id || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const { error } = await supabase
      .from("vendor_types")
      .update({
        name: editName,
        default_assigned_user_id: editUserId && editUserId !== "none" ? editUserId : null,
      })
      .eq("id", editingId);

    if (error) {
      toast.error("Failed to update vendor type");
      return;
    }

    setVendorTypes(
      vendorTypes.map((t) =>
        t.id === editingId
          ? { ...t, name: editName, default_assigned_user_id: editUserId && editUserId !== "none" ? editUserId : null }
          : t
      )
    );
    setEditingId(null);
    setEditName("");
    setEditUserId("");
    toast.success("Vendor type updated");
  };

  const deleteVendorType = async (id: string) => {
    const { error } = await supabase
      .from("vendor_types")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete vendor type");
      return;
    }

    setVendorTypes(vendorTypes.filter((t) => t.id !== id));
    toast.success("Vendor type deleted");
  };

  const getUserById = (userId: string | null) => {
    if (!userId) return null;
    return users.find((u) => u.id === userId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Vendor Types</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New vendor type..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addVendorType()}
              className="flex-1"
            />
            <Select value={newTypeUserId} onValueChange={setNewTypeUserId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Default user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <UserAvatar avatarUrl={user.avatar_url} name={user.full_name} size="sm" />
                      {user.full_name || "Unknown"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addVendorType} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {vendorTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between gap-2 p-3 border rounded-md"
              >
                {editingId === type.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={editUserId} onValueChange={setEditUserId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Default user..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <UserAvatar avatarUrl={user.avatar_url} name={user.full_name} size="sm" />
                              {user.full_name || "Unknown"}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={saveEdit} size="sm">
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-medium">{type.name}</div>
                      {type.default_assigned_user_id && (
                        <div className="flex items-center gap-2 mt-1">
                          <UserAvatar
                            avatarUrl={getUserById(type.default_assigned_user_id)?.avatar_url}
                            name={getUserById(type.default_assigned_user_id)?.full_name}
                            size="sm"
                          />
                          <span className="text-sm text-muted-foreground">
                            {getUserById(type.default_assigned_user_id)?.full_name || "Unknown"}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(type)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteVendorType(type.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
