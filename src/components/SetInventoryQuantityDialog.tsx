import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SetInventoryQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtaskDescription: string;
  inventoryTypeName: string;
  currentQuantity?: number;
  onSave: (quantity: number) => void;
}

export default function SetInventoryQuantityDialog({
  open,
  onOpenChange,
  subtaskDescription,
  inventoryTypeName,
  currentQuantity,
  onSave,
}: SetInventoryQuantityDialogProps) {
  const [quantity, setQuantity] = useState<string>(currentQuantity?.toString() || "");

  const handleSave = () => {
    const qty = parseInt(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      return;
    }
    onSave(qty);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Inventory Quantity</DialogTitle>
          <DialogDescription>
            How many items are needed for this task?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Task</Label>
            <p className="text-sm text-muted-foreground">{subtaskDescription}</p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Inventory Type</Label>
            <Badge variant="outline" className="font-normal">
              {inventoryTypeName}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              Quantity Needed <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!quantity || parseInt(quantity) <= 0 || isNaN(parseInt(quantity))}
          >
            Save Quantity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
