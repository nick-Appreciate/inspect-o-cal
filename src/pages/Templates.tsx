import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateBuilder } from "@/components/TemplateBuilder";
import { InventoryTypesDialog } from "@/components/InventoryTypesDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Template {
  id: string;
  name: string;
  description: string | null;
  type?: string | null;
}

const inspectionTypes = [
  "S8 - RFT",
  "S8 - 1st Annual",
  "S8 - Reinspection",
  "S8 - Abatement Cure",
  "Rental License",
  "HUD",
];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState("");
  const [duplicateFromTemplate, setDuplicateFromTemplate] = useState("");
  const [showInventoryTypes, setShowInventoryTypes] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("inspection_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load templates");
      return;
    }

    setTemplates(data || []);
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!newTemplateType) {
      toast.error("Please select an inspection type");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("inspection_templates")
      .insert({
        name: newTemplateName,
        type: newTemplateType,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create template");
      return;
    }

    // If duplicating from another template, copy rooms and items
    if (duplicateFromTemplate) {
      await duplicateTemplateContent(duplicateFromTemplate, data.id);
    }

    setTemplates([data, ...templates]);
    setSelectedTemplate(data.id);
    setNewTemplateName("");
    setNewTemplateType("");
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inspection Templates</h1>
        <div className="flex gap-2">
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
              <Label>Inspection Type *</Label>
              <Select value={newTemplateType} onValueChange={setNewTemplateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select inspection type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {inspectionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  setNewTemplateType("");
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
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateBuilder
          templateId={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      <InventoryTypesDialog
        open={showInventoryTypes}
        onOpenChange={setShowInventoryTypes}
      />
    </div>
  );
}
