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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InventoryType {
  id: string;
  name: string;
}

export function InventoryTypesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    if (open) {
      fetchInventoryTypes();
    }
  }, [open]);

  const fetchInventoryTypes = async () => {
    const { data, error } = await supabase
      .from("inventory_types")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load inventory types");
      return;
    }

    setInventoryTypes(data || []);
  };

  const addInventoryType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("inventory_types")
      .insert({
        name: newTypeName,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add inventory type");
      return;
    }

    setInventoryTypes([...inventoryTypes, data]);
    setNewTypeName("");
    toast.success("Inventory type added");
  };

  const deleteInventoryType = async (id: string) => {
    const { error } = await supabase
      .from("inventory_types")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete inventory type");
      return;
    }

    setInventoryTypes(inventoryTypes.filter((t) => t.id !== id));
    toast.success("Inventory type deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Inventory Types</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New inventory type..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInventoryType()}
            />
            <Button onClick={addInventoryType} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {inventoryTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <span>{type.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteInventoryType(type.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
