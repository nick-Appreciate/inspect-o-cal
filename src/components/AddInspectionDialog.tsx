import { useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Inspection, InspectionType, Property } from "@/types/inspection";
import { toast } from "sonner";

interface AddInspectionDialogProps {
  properties: Property[];
  onAddInspection: (inspection: Omit<Inspection, "id">) => void;
  onAddProperty: (property: Omit<Property, "id">) => void;
}

const inspectionTypes: InspectionType[] = [
  "S8 - RFT",
  "S8 - 1st Annual",
  "S8 - Reinspection",
  "S8 - Abatement Cure",
  "Rental License",
  "HUD",
];

export default function AddInspectionDialog({
  properties,
  onAddInspection,
  onAddProperty,
}: AddInspectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [date, setDate] = useState<Date>();
  const [type, setType] = useState<InspectionType>();
  const [time, setTime] = useState("12:00");
  const [selectedProperty, setSelectedProperty] = useState<Property>();
  const [attachment, setAttachment] = useState<File>();
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyAddress, setNewPropertyAddress] = useState("");

  const handleSubmit = () => {
    if (!type || !date || !time || !selectedProperty) {
      toast.error("Please fill in all required fields");
      return;
    }

    onAddInspection({
      type,
      date,
      time,
      property: selectedProperty,
      attachment,
    });

    toast.success("Inspection added successfully");
    setOpen(false);
    resetForm();
  };

  const handleAddProperty = () => {
    if (!newPropertyName || !newPropertyAddress) {
      toast.error("Please fill in property details");
      return;
    }

    onAddProperty({
      name: newPropertyName,
      address: newPropertyAddress,
    });

    toast.success("Property added successfully");
    setShowAddProperty(false);
    setNewPropertyName("");
    setNewPropertyAddress("");
  };

  const resetForm = () => {
    setDate(undefined);
    setType(undefined);
    setTime("");
    setSelectedProperty(undefined);
    setAttachment(undefined);
    setShowAddProperty(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Inspection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Inspection</DialogTitle>
          <DialogDescription>
            Schedule a new property inspection with all required details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Inspection Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as InspectionType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select inspection type" />
              </SelectTrigger>
              <SelectContent>
                {inspectionTypes.map((inspectionType) => (
                  <SelectItem key={inspectionType} value={inspectionType}>
                    {inspectionType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Inspection Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Inspection Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {!showAddProperty ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Property</Label>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowAddProperty(true)}
                  className="h-auto p-0 text-primary"
                >
                  + Add New Property
                </Button>
              </div>
              <Select
                value={selectedProperty?.id}
                onValueChange={(value) => {
                  const property = properties.find((p) => p.id === value);
                  setSelectedProperty(property);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - {property.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg bg-accent/50">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">New Property</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddProperty(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyName">Property Name</Label>
                <Input
                  id="propertyName"
                  value={newPropertyName}
                  onChange={(e) => setNewPropertyName(e.target.value)}
                  placeholder="e.g., Oakwood Apartments"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Address</Label>
                <Input
                  id="propertyAddress"
                  value={newPropertyAddress}
                  onChange={(e) => setNewPropertyAddress(e.target.value)}
                  placeholder="e.g., 123 Main St, City, State"
                />
              </div>
              <Button onClick={handleAddProperty} className="w-full" size="sm">
                Save Property
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="attachment">Attachment (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="attachment"
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("attachment")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {attachment ? attachment.name : "Upload File"}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Inspection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
