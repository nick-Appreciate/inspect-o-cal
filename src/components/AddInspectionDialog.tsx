import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface Unit {
  id: string;
  property_id: string;
  name: string;
  floorplan?: { name: string } | null;
}

interface Template {
  id: string;
  name: string;
}

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
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>();
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Fetch units and templates when property is selected
  useEffect(() => {
    if (selectedProperty?.id) {
      fetchUnits(selectedProperty.id);
      fetchTemplates();
    } else {
      setUnits([]);
      setSelectedUnit(undefined);
      setTemplates([]);
      setSelectedTemplate("");
    }
  }, [selectedProperty]);

  const fetchTemplates = async () => {
    if (!selectedProperty?.id) return;
    
    try {
      let query = supabase
        .from("inspection_templates")
        .select("id, name, floorplan_id, template_properties(property_id)");

      // If unit is selected, filter by floorplan
      if (selectedUnit && selectedUnit !== "none") {
        const { data: unitData } = await supabase
          .from("units")
          .select("floorplan_id")
          .eq("id", selectedUnit)
          .single();

        if (unitData?.floorplan_id) {
          query = query.eq("floorplan_id", unitData.floorplan_id);
        }
      } else {
        // Filter by property associations
        const { data: propertyTemplates } = await supabase
          .from("template_properties")
          .select("template_id")
          .eq("property_id", selectedProperty.id);

        if (propertyTemplates && propertyTemplates.length > 0) {
          const templateIds = propertyTemplates.map(pt => pt.template_id);
          query = query.in("id", templateIds);
        }
      }

      const { data } = await query.order("name");
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    const { data, error } = await supabase
      .from("units")
      .select(`
        *,
        floorplan:floorplans(name)
      `)
      .eq("property_id", propertyId);

    if (!error && data) {
      // Sort units using natural/numeric sorting
      const sortedData = [...data].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });
      setUnits(sortedData);
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim() || !selectedProperty?.id) {
      toast.error("Please enter a unit name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const { data, error } = await supabase
      .from("units")
      .insert({
        property_id: selectedProperty.id,
        name: newUnitName.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add unit");
      return;
    }

    setUnits([...units, data]);
    setSelectedUnit(data.id);
    setShowAddUnit(false);
    setNewUnitName("");
    toast.success("Unit added successfully");
  };

  const handleSubmit = async () => {
    if (!type || !date || !time || !selectedProperty) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedTemplate) {
      toast.error("Please select an inspection template");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      // Create the inspection
      const { data: inspection, error: inspectionError } = await supabase
        .from("inspections")
        .insert({
          type,
          date: date.toISOString().split('T')[0],
          time,
          property_id: selectedProperty.id,
          unit_id: selectedUnit && selectedUnit !== "none" ? selectedUnit : null,
          created_by: user.id,
          inspection_template_id: selectedTemplate,
        })
        .select()
        .single();

      if (inspectionError) throw inspectionError;

      // Fetch template rooms and items
      const { data: rooms } = await supabase
        .from("template_rooms")
        .select("*")
        .eq("template_id", selectedTemplate)
        .order("order_index");

      if (rooms) {
        for (const room of rooms) {
          // Fetch items for this room
          const { data: items } = await supabase
            .from("template_items")
            .select("*")
            .eq("room_id", room.id)
            .order("order_index");

          if (items && items.length > 0) {
            // Create subtasks for each item
            const subtasks = items.map(item => ({
              inspection_id: inspection.id,
              original_inspection_id: inspection.id,
              description: item.description,
              room_name: room.name,
              inventory_type_id: item.inventory_type_id,
              inventory_quantity: item.inventory_quantity || 0,
              status: 'pending',
              completed: false,
              created_by: user.id,
            }));

            const { error: subtasksError } = await supabase
              .from("subtasks")
              .insert(subtasks);

            if (subtasksError) throw subtasksError;
          }
        }
      }

      onAddInspection({
        type,
        date,
        time,
        property: selectedProperty,
        attachment,
        unitId: selectedUnit && selectedUnit !== "none" ? selectedUnit : null,
      });

      toast.success("Inspection created with checklist items");
      setOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating inspection:", error);
      toast.error("Failed to create inspection");
    }
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
    setUnits([]);
    setSelectedUnit(undefined);
    setShowAddUnit(false);
    setNewUnitName("");
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
        <div className="p-6 pb-3 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Add New Inspection</DialogTitle>
            <DialogDescription>
              Schedule a new property inspection with all required details.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
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

          {selectedProperty && !showAddProperty && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Unit (Optional)</Label>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAddUnit(!showAddUnit)}
                    className="h-auto p-0 text-primary"
                  >
                    {showAddUnit ? "Cancel" : "+ Add New Unit"}
                  </Button>
                </div>
              
              {!showAddUnit ? (
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a unit (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No unit</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                        {unit.floorplan && (
                          <span className="text-muted-foreground ml-2">
                            ({unit.floorplan.name})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2 p-3 border rounded-lg bg-accent/30">
                  <Input
                    placeholder="Unit name (e.g., Unit 101, Apt A)"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddUnit();
                      }
                    }}
                  />
                  <Button onClick={handleAddUnit} className="w-full" size="sm">
                    Save Unit
                  </Button>
                </div>
              )}
              </div>

              <div className="space-y-2">
                <Label>Inspection Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
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
        <div className="p-6 pt-3 flex-shrink-0 border-t">
          <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Inspection</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
