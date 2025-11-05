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

interface CompleteInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainInspection: Inspection | null;
  connectedInspections: Inspection[];
  onConfirm: (inspectionIds: string[]) => void;
}

export function CompleteInspectionDialog({
  open,
  onOpenChange,
  mainInspection,
  connectedInspections,
  onConfirm,
}: CompleteInspectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset selections when dialog opens with new inspection
    if (open && mainInspection) {
      setSelectedIds(new Set());
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
    const idsToComplete = [mainInspection.id, ...Array.from(selectedIds)];
    console.log('CompleteInspectionDialog - Main Inspection:', {
      id: mainInspection.id,
      type: mainInspection.type,
      date: mainInspection.date,
      parentId: mainInspection.parent_inspection_id
    });
    console.log('CompleteInspectionDialog - Selected IDs:', Array.from(selectedIds));
    console.log('CompleteInspectionDialog - All IDs to complete:', idsToComplete);
    onConfirm(idsToComplete);
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
          <DialogTitle>Mark Inspection as Complete</DialogTitle>
          <DialogDescription>
            You are marking this inspection as complete:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main inspection being completed */}
          <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
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
                Select additional inspections to mark as complete:
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Mark {selectedIds.size > 0 ? `${selectedIds.size + 1} Inspections` : "Inspection"} as Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
