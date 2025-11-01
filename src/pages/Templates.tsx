import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateBuilder } from "@/components/TemplateBuilder";
import { InventoryTypesDialog } from "@/components/InventoryTypesDialog";
import { ManageRoomsDialog } from "@/components/ManageRoomsDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Template {
  id: string;
  name: string;
  description: string | null;
  floorplan_id?: string | null;
  floorplan?: { name: string } | null;
  template_properties?: { property_id: string; properties: { name: string } }[];
}

interface Floorplan {
  id: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newFloorplanId, setNewFloorplanId] = useState("");
  const [newFloorplanName, setNewFloorplanName] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [duplicateFromTemplate, setDuplicateFromTemplate] = useState("");
  const [showInventoryTypes, setShowInventoryTypes] = useState(false);
  const [showManageRooms, setShowManageRooms] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [floorplans, setFloorplans] = useState<Floorplan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchFloorplans();
    fetchProperties();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("inspection_templates")
      .select(`
        *,
        floorplan:floorplans(name),
        template_properties(
          property_id,
          properties(name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load templates");
      return;
    }

    // Filter out template_properties where the property no longer exists
    const cleanedData = data?.map(template => ({
      ...template,
      template_properties: template.template_properties?.filter(
        (tp: any) => tp.properties != null
      )
    })) || [];

    setTemplates(cleanedData);
  };

  const fetchFloorplans = async () => {
    const { data, error } = await supabase
      .from("floorplans")
      .select("*")
      .order("name");

    if (!error && data) {
      setFloorplans(data);
    }
  };

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (!error && data) {
      setProperties(data);
    }
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let floorplanId = newFloorplanId;

    // Create new floorplan if name is provided
    if (newFloorplanName.trim()) {
      const { data: newFloorplan, error: floorplanError } = await supabase
        .from("floorplans")
        .insert({
          name: newFloorplanName,
          created_by: user.id,
        })
        .select()
        .single();

      if (floorplanError) {
        toast.error("Failed to create floorplan");
        return;
      }

      floorplanId = newFloorplan.id;
      setFloorplans([...floorplans, newFloorplan]);
    }

    const { data, error } = await supabase
      .from("inspection_templates")
      .insert({
        name: newTemplateName,
        floorplan_id: floorplanId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create template");
      return;
    }

    // Associate template with selected properties
    if (selectedPropertyIds.length > 0) {
      const propertyAssociations = selectedPropertyIds.map(propertyId => ({
        template_id: data.id,
        property_id: propertyId,
      }));

      await supabase.from("template_properties").insert(propertyAssociations);
    }

    // If duplicating from another template, copy rooms and items
    if (duplicateFromTemplate) {
      await duplicateTemplateContent(duplicateFromTemplate, data.id);
    }

    await fetchTemplates();
    setSelectedTemplate(data.id);
    setNewTemplateName("");
    setNewFloorplanId("");
    setNewFloorplanName("");
    setSelectedPropertyIds([]);
    setDuplicateFromTemplate("");
    setShowNewTemplate(false);
    toast.success("Template created");
  };

  const duplicateTemplateContent = async (sourceTemplateId: string, targetTemplateId: string) => {
    // Fetch rooms from source template
    const { data: rooms, error: roomsError } = await supabase
      .from("template_rooms")
      .select("*")
      .eq("template_id", sourceTemplateId)
      .order("order_index");

    if (roomsError || !rooms) {
      toast.error("Failed to duplicate rooms");
      return;
    }

    // Create new rooms in target template
    for (const room of rooms) {
      const { data: newRoom, error: newRoomError } = await supabase
        .from("template_rooms")
        .insert({
          template_id: targetTemplateId,
          name: room.name,
          order_index: room.order_index,
        })
        .select()
        .single();

      if (newRoomError || !newRoom) {
        toast.error(`Failed to duplicate room: ${room.name}`);
        continue;
      }

      // Fetch items for this room
      const { data: items, error: itemsError } = await supabase
        .from("template_items")
        .select("*")
        .eq("room_id", room.id)
        .order("order_index");

      if (itemsError || !items) continue;

      // Create new items in the new room
      const newItems = items.map(item => ({
        room_id: newRoom.id,
        description: item.description,
        inventory_quantity: item.inventory_quantity,
        inventory_type_id: item.inventory_type_id,
        order_index: item.order_index,
      }));

      if (newItems.length > 0) {
        await supabase.from("template_items").insert(newItems);
      }
    }
  };

  const deleteTemplate = async () => {
    if (!deleteTemplateId) return;

    const { error } = await supabase
      .from("inspection_templates")
      .delete()
      .eq("id", deleteTemplateId);

    if (error) {
      toast.error("Failed to delete template");
      return;
    }

    setTemplates(templates.filter((t) => t.id !== deleteTemplateId));
    if (selectedTemplate === deleteTemplateId) {
      setSelectedTemplate(null);
    }
    setDeleteTemplateId(null);
    toast.success("Template deleted");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inspection Templates</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowManageRooms(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Rooms
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowInventoryTypes(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Inventory Types
          </Button>
          <Button onClick={() => setShowNewTemplate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {showNewTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                placeholder="Template name..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div>
              <Label>Floorplan (Optional)</Label>
              <Select 
                value={newFloorplanId} 
                onValueChange={(value) => {
                  setNewFloorplanId(value);
                  if (value) setNewFloorplanName("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select existing floorplan" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {floorplans.map((floorplan) => (
                    <SelectItem key={floorplan.id} value={floorplan.id}>
                      {floorplan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Or Create New Floorplan</Label>
              <Input
                placeholder="New floorplan name..."
                value={newFloorplanName}
                onChange={(e) => {
                  setNewFloorplanName(e.target.value);
                  if (e.target.value) setNewFloorplanId("");
                }}
              />
            </div>
            <div>
              <Label>Associate with Properties (Optional)</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No properties available</p>
                ) : (
                  properties.map((property) => (
                    <div key={property.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={property.id}
                        checked={selectedPropertyIds.includes(property.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPropertyIds([...selectedPropertyIds, property.id]);
                          } else {
                            setSelectedPropertyIds(selectedPropertyIds.filter(id => id !== property.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={property.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {property.name} - {property.address}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label>Duplicate from Template (Optional)</Label>
              <Select value={duplicateFromTemplate} onValueChange={setDuplicateFromTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createTemplate} className="flex-1">Create</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTemplate(false);
                  setNewTemplateName("");
                  setNewFloorplanId("");
                  setNewFloorplanName("");
                  setSelectedPropertyIds([]);
                  setDuplicateFromTemplate("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-colors ${
              selectedTemplate === template.id
                ? "border-primary"
                : "hover:border-muted-foreground"
            }`}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex-1" onClick={() => setSelectedTemplate(template.id)}>
                <CardTitle>{template.name}</CardTitle>
                <div className="space-y-1 mt-1">
                  {template.floorplan && (
                    <p className="text-sm text-muted-foreground">
                      Floorplan: {template.floorplan.name}
                    </p>
                  )}
                  {template.template_properties && template.template_properties.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Properties: {template.template_properties.map(tp => tp.properties.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTemplateId(template.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateBuilder
          templateId={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onOpenRoomTemplates={() => setShowManageRooms(true)}
        />
      )}

      <ManageRoomsDialog
        open={showManageRooms}
        onOpenChange={setShowManageRooms}
      />

      <InventoryTypesDialog
        open={showInventoryTypes}
        onOpenChange={setShowInventoryTypes}
      />

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This will also delete all rooms and items associated with it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
