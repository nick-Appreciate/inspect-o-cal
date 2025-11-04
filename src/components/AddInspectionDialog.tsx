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
import MultiUnitTemplateSelector from "./MultiUnitTemplateSelector";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Multi-unit inspection state
  const [isMultiUnit, setIsMultiUnit] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [unitTemplates, setUnitTemplates] = useState<Record<string, string>>({});

  // Fetch units when property is selected
  useEffect(() => {
    if (selectedProperty?.id) {
      fetchUnits(selectedProperty.id);
    } else {
      setUnits([]);
      setSelectedUnit(undefined);
    }
  }, [selectedProperty]);
  
  // Detect if inspection type requires multi-unit support
  useEffect(() => {
    if (type === "HUD" || type === "Rental License") {
      setIsMultiUnit(true);
      setSelectedUnit(undefined);
      setSelectedTemplate("");
    } else {
      setIsMultiUnit(false);
      setSelectedUnits([]);
      setUnitTemplates({});
    }
  }, [type]);

  // Fetch templates when property or unit changes
  useEffect(() => {
    if (selectedProperty?.id && !isMultiUnit) {
      fetchTemplates();
    } else {
      if (!isMultiUnit) {
        setTemplates([]);
        setSelectedTemplate("");
      }
    }
  }, [selectedProperty, selectedUnit, isMultiUnit]);

  const fetchTemplates = async () => {
    if (!selectedProperty?.id) return;
    
    try {
      // If "Entire Property" is selected
      if (selectedUnit === "entire-property") {
        // Show templates with no floorplan (entire property) that are associated with this property
        const { data: propertyTemplates } = await supabase
          .from("template_properties")
          .select("template_id")
          .eq("property_id", selectedProperty.id);

        if (propertyTemplates && propertyTemplates.length > 0) {
          const templateIds = propertyTemplates.map(pt => pt.template_id);
          const { data } = await supabase
            .from("inspection_templates")
            .select("id, name, floorplan_id, template_properties(property_id)")
            .in("id", templateIds)
            .is("floorplan_id", null)
            .order("name");
          
          setTemplates(data || []);
        } else {
          setTemplates([]);
        }
        return;
      }
      
      let query = supabase
        .from("inspection_templates")
        .select("id, name, floorplan_id, template_properties(property_id)");

      // If a specific unit is selected, filter by floorplan
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
        // Filter by property associations (any template for this property)
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
  
  const fetchTemplatesForUnit = async (unitId: string | null) => {
    if (!selectedProperty?.id) {
      console.log("No property selected");
      return [];
    }
    
    try {
      if (unitId === "entire-property" || unitId === null) {
        console.log("Fetching templates for entire property, property ID:", selectedProperty.id);
        
        // For entire property, get templates with null floorplan associated with this property
        const { data: propertyTemplates, error: propError } = await supabase
          .from("template_properties")
          .select("template_id")
          .eq("property_id", selectedProperty.id);

        console.log("Property template associations:", propertyTemplates, "Error:", propError);

        if (propertyTemplates && propertyTemplates.length > 0) {
          const templateIds = propertyTemplates.map(pt => pt.template_id);
          const { data, error: templateError } = await supabase
            .from("inspection_templates")
            .select("id, name, floorplan_id")
            .in("id", templateIds)
            .is("floorplan_id", null)
            .order("name");
          
          console.log("Entire property templates found:", data, "Error:", templateError);
          return data || [];
        }
        console.log("No property template associations found");
        return [];
      } else {
        // For specific units, get templates matching the unit's floorplan
        const { data: unitData } = await supabase
          .from("units")
          .select("floorplan_id")
          .eq("id", unitId)
          .single();

        if (unitData?.floorplan_id) {
          const { data } = await supabase
            .from("inspection_templates")
            .select("id, name, floorplan_id")
            .eq("floorplan_id", unitData.floorplan_id)
            .order("name");
          
          console.log(`Templates for unit ${unitId} with floorplan ${unitData.floorplan_id}:`, data);
          return data || [];
        }
        return [];
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      return [];
    }
  };
  
  const handleUnitSelection = (unitId: string) => {
    setSelectedUnits(prev => {
      if (prev.includes(unitId)) {
        // Remove unit and its template selection
        const newUnits = prev.filter(id => id !== unitId);
        const newTemplates = { ...unitTemplates };
        delete newTemplates[unitId];
        setUnitTemplates(newTemplates);
        return newUnits;
      } else {
        return [...prev, unitId];
      }
    });
  };
  
  const handleTemplateForUnit = (unitId: string, templateId: string) => {
    setUnitTemplates(prev => ({
      ...prev,
      [unitId]: templateId
    }));
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

    // Validation for multi-unit inspections
    if (isMultiUnit) {
      if (selectedUnits.length === 0) {
        toast.error("Please select at least one unit");
        return;
      }
      
      // Check that all selected units have templates assigned
      const unitsWithoutTemplates = selectedUnits.filter(unitId => !unitTemplates[unitId]);
      if (unitsWithoutTemplates.length > 0) {
        toast.error("Please assign a template to all selected units");
        return;
      }
    } else {
      if (!selectedTemplate) {
        toast.error("Please select an inspection template");
        return;
      }
    }

    if (isSubmitting) {
      return; // Prevent double submission
    }

    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      // Upload attachment if provided and get URL
      let attachmentUrl: string | undefined;
      if (attachment) {
        const fileExt = attachment.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, attachment);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from("attachments")
          .getPublicUrl(fileName);
        attachmentUrl = publicUrl;
      }

      // Create the inspection
      const { data: inspection, error: inspectionError } = await supabase
        .from("inspections")
        .insert({
          type,
          date: date.toISOString().split('T')[0],
          time,
          property_id: selectedProperty.id,
          unit_id: !isMultiUnit && selectedUnit && selectedUnit !== "none" && selectedUnit !== "entire-property" ? selectedUnit : null,
          created_by: user.id,
          inspection_template_id: !isMultiUnit ? selectedTemplate : null,
          attachment_url: attachmentUrl,
        })
        .select()
        .single();

      if (inspectionError) throw inspectionError;

      // Handle multi-unit inspections
      if (isMultiUnit) {
        // Create inspection_unit_templates associations
        const associations = selectedUnits.map(unitId => ({
          inspection_id: inspection.id,
          unit_id: unitId === "entire-property" ? null : unitId,
          template_id: unitTemplates[unitId],
          created_by: user.id,
        }));

        const { error: associationError } = await supabase
          .from("inspection_unit_templates")
          .insert(associations);

        if (associationError) throw associationError;

        // Create subtasks for each unit-template combination
        for (const unitId of selectedUnits) {
          const templateId = unitTemplates[unitId];
          await createSubtasksForTemplate(inspection.id, templateId, user.id, unitId);
        }
      } else {
        // Single template inspection - existing logic
        await createSubtasksForTemplate(inspection.id, selectedTemplate, user.id, 
          selectedUnit && selectedUnit !== "none" && selectedUnit !== "entire-property" ? selectedUnit : null);
      }

      console.log("Inspection created successfully with all tasks");

      onAddInspection({
        type,
        date,
        time,
        property: selectedProperty,
        attachment,
        unitId: !isMultiUnit && selectedUnit && selectedUnit !== "none" && selectedUnit !== "entire-property" ? selectedUnit : null,
      });

      toast.success("Inspection created with checklist items");
      setOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating inspection:", error);
      toast.error("Failed to create inspection");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const createSubtasksForTemplate = async (
    inspectionId: string, 
    templateId: string, 
    userId: string,
    unitId: string | null
  ) => {
    // Step 1: Fetch template rooms with ordering
    const { data: templateRooms, error: roomsError } = await supabase
      .from("template_rooms")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index");

    if (roomsError) {
      console.error("Failed to fetch template rooms:", roomsError);
      throw new Error("Failed to load inspection template rooms");
    }

    if (!templateRooms || templateRooms.length === 0) {
      console.warn("No rooms found in template:", templateId);
      throw new Error("This template has no rooms configured. Please add rooms to the template first.");
    }

    console.log(`Creating inspection with ${templateRooms.length} rooms from template`);

    // Step 2: Create inspection_rooms one by one to ensure all are created
    const roomIdMap = new Map<string, string>();
    
    for (const templateRoom of templateRooms) {
      const { data: newRoom, error: roomError } = await supabase
        .from("inspection_rooms")
        .insert({
          inspection_id: inspectionId,
          name: templateRoom.name,
          order_index: templateRoom.order_index,
          created_by: userId,
        })
        .select()
        .single();

      if (roomError || !newRoom) {
        console.error(`Failed to create room "${templateRoom.name}":`, roomError);
        throw new Error(`Failed to create room "${templateRoom.name}"`);
      }

      roomIdMap.set(templateRoom.id, newRoom.id);
      console.log(`Created room "${templateRoom.name}" (${templateRoom.order_index})`);
    }

    console.log(`Created ${roomIdMap.size} inspection rooms successfully`);

    // Step 3: Copy template_items to subtasks with proper ordering
    const allSubtasks: {
      inspection_id: string;
      original_inspection_id: string;
      inspection_room_id: string;
      description: string;
      room_name: string;
      inventory_type_id: string | null;
      vendor_type_id: string | null;
      inventory_quantity: number;
      order_index: number;
      status: string;
      completed: boolean;
      created_by: string;
    }[] = [];

    for (const templateRoom of templateRooms) {
      const { data: templateItems, error: itemsError } = await supabase
        .from("template_items")
        .select("*")
        .eq("room_id", templateRoom.id)
        .order("order_index");

      if (itemsError) {
        console.error(`Failed to fetch items for room ${templateRoom.name}:`, itemsError);
        continue;
      }

      if (templateItems && templateItems.length > 0) {
        const inspectionRoomId = roomIdMap.get(templateRoom.id);
        if (!inspectionRoomId) {
          console.error(`Missing inspection_room_id for template room ${templateRoom.id}`);
          throw new Error(`Room mapping error for "${templateRoom.name}"`);
        }

        const roomSubtasks = templateItems.map(item => ({
          inspection_id: inspectionId,
          original_inspection_id: inspectionId,
          inspection_room_id: inspectionRoomId,
          description: item.description,
          room_name: templateRoom.name,
          inventory_type_id: item.inventory_type_id,
          vendor_type_id: item.vendor_type_id,
          inventory_quantity: item.inventory_quantity || 0,
          order_index: item.order_index,
          status: 'pending',
          completed: false,
          created_by: userId,
        }));
        
        allSubtasks.push(...roomSubtasks);
        console.log(`Room "${templateRoom.name}": ${roomSubtasks.length} tasks copied (ordered)`);
      } else {
        console.warn(`Room "${templateRoom.name}" has no template items`);
      }
    }

    if (allSubtasks.length === 0) {
      console.warn("No subtasks created for inspection");
      throw new Error("No tasks found in template. Please add tasks to the template rooms.");
    }

    console.log(`Inserting ${allSubtasks.length} total subtasks from ${templateRooms.length} rooms`);

    const { error: subtasksError } = await supabase
      .from("subtasks")
      .insert(allSubtasks);

    if (subtasksError) {
      console.error("Failed to insert subtasks:", subtasksError);
      throw subtasksError;
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
    setTime("12:00");
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
              {!isMultiUnit ? (
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
                      <SelectContent className="bg-background z-50 border shadow-lg">
                        <SelectItem value="entire-property">Entire Property</SelectItem>
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
                      <SelectContent className="bg-background z-50 border shadow-lg">
                        {templates.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            No templates available for this selection
                          </div>
                        )}
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <MultiUnitTemplateSelector
                  units={units}
                  selectedUnits={selectedUnits}
                  unitTemplates={unitTemplates}
                  onUnitSelection={handleUnitSelection}
                  onTemplateForUnit={handleTemplateForUnit}
                  fetchTemplatesForUnit={fetchTemplatesForUnit}
                />
              )}
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
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Add Inspection"}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
