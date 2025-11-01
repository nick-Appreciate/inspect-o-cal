import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface InventoryType {
  id: string;
  name: string;
}

interface VendorType {
  id: string;
  name: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: {
    description: string;
    inventory_quantity: number;
    inventory_type_id: string | null;
    vendor_type_id: string | null;
  }) => void;
  inventoryTypes: InventoryType[];
  vendorTypes?: VendorType[];
  onCreateInventoryType: (name: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onAdd,
  inventoryTypes,
  vendorTypes = [],
  onCreateInventoryType,
  title = "Add Task",
  description = "Add a new task to the checklist",
}: AddTaskDialogProps) {
  const [taskDescription, setTaskDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [typeId, setTypeId] = useState("");
  const [vendorTypeId, setVendorTypeId] = useState("");
  const [showAddInventoryType, setShowAddInventoryType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const handleAdd = () => {
    if (!taskDescription.trim()) {
      return;
    }

    onAdd({
      description: taskDescription,
      inventory_quantity: quantity,
      inventory_type_id: typeId && typeId !== "none" ? typeId : null,
      vendor_type_id: vendorTypeId && vendorTypeId !== "none" ? vendorTypeId : null,
    });

    // Reset form
    setTaskDescription("");
    setQuantity(0);
    setTypeId("");
    setVendorTypeId("");
    onOpenChange(false);
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    await onCreateInventoryType(newTypeName.trim());
    setNewTypeName("");
    setShowAddInventoryType(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Task description..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && taskDescription.trim()) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="type">Inventory Type (Optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddInventoryType(!showAddInventoryType)}
                className="h-auto py-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Type
              </Button>
            </div>

            {showAddInventoryType ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Type name..."
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTypeName.trim()) {
                      handleCreateType();
                    } else if (e.key === "Escape") {
                      setShowAddInventoryType(false);
                      setNewTypeName("");
                    }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateType}
                  disabled={!newTypeName.trim()}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddInventoryType(false);
                    setNewTypeName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger id="type">
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
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Inventory Quantity (Optional)</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              placeholder="0"
              value={quantity || ""}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
          </div>
          {vendorTypes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="vendor-type">Vendor Type (Optional)</Label>
              <Select value={vendorTypeId} onValueChange={setVendorTypeId}>
                <SelectTrigger id="vendor-type">
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">None</SelectItem>
                  {vendorTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!taskDescription.trim()}>
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
