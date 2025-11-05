import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatInTimeZone } from "date-fns-tz";

interface Property {
  id: string;
  name: string;
}

interface Unit {
  name: string;
}

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  property: Property;
  unit?: Unit;
  parent_inspection_id: string | null;
  completed: boolean;
}

interface DeleteInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainInspection: Inspection | null;
  connectedInspections: Inspection[];
  onConfirm: (inspectionIds: string[], keepForAnalytics: boolean) => void;
}

export function DeleteInspectionDialog({
  open,
  onOpenChange,
  mainInspection,
  connectedInspections,
  onConfirm,
}: DeleteInspectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keepForAnalytics, setKeepForAnalytics] = useState<string>("yes");

  useEffect(() => {
    // Reset selections when dialog opens with new inspection
    if (open && mainInspection) {
      setSelectedIds(new Set());
      setKeepForAnalytics("yes");
    }
  }, [open, mainInspection]);

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === connectedInspections.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(connectedInspections.map(i => i.id)));
    }
  };

  const handleConfirm = () => {
    if (!mainInspection) return;
    const idsToDelete = [mainInspection.id, ...Array.from(selectedIds)];
    onConfirm(idsToDelete, keepForAnalytics === "yes");
    onOpenChange(false);
  };

  if (!mainInspection) return null;

  const formatInspectionDetails = (inspection: Inspection) => {
    const dateStr = formatInTimeZone(new Date(inspection.date + 'T00:00:00'), 'America/Chicago', "MMM d, yyyy");
    const parts = [inspection.type, dateStr];
    if (inspection.property) parts.push(inspection.property.name);
    if (inspection.unit?.name) parts.push(inspection.unit.name);
    return parts.join(" • ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delete Inspection</DialogTitle>
          <DialogDescription>
            You are deleting this inspection:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main inspection being deleted */}
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div className="font-medium">{formatInspectionDetails(mainInspection)}</div>
          </div>

          {/* Connected inspections */}
          {connectedInspections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Connected Inspections ({connectedInspections.length})
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === connectedInspections.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Select additional inspections to delete:
              </p>

              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-3">
                  {connectedInspections.map((inspection) => (
                    <div
                      key={inspection.id}
                      className="flex items-start space-x-3 rounded-lg p-2 hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        id={inspection.id}
                        checked={selectedIds.has(inspection.id)}
                        onCheckedChange={() => handleToggle(inspection.id)}
                      />
                      <Label
                        htmlFor={inspection.id}
                        className="flex-1 cursor-pointer text-sm leading-relaxed"
                      >
                        {formatInspectionDetails(inspection)}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Analytics option */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-semibold">Analytics Data</Label>
            <p className="text-sm text-muted-foreground">
              Should this inspection data be included in analytics reports?
            </p>
            <RadioGroup value={keepForAnalytics} onValueChange={setKeepForAnalytics}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="analytics-yes" />
                <Label htmlFor="analytics-yes" className="font-normal cursor-pointer">
                  Yes, keep for analytics (data will be hidden from regular views)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="analytics-no" />
                <Label htmlFor="analytics-no" className="font-normal cursor-pointer">
                  No, permanently delete all data
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Delete {selectedIds.size > 0 ? `${selectedIds.size + 1} Inspections` : "Inspection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
