import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string | null;
}

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionType: string;
  inspectionId: string;
  onTemplateApplied?: () => void;
}

export function TemplateSelector({
  open,
  onOpenChange,
  inspectionType,
  inspectionId,
  onTemplateApplied,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && inspectionType) {
      fetchTemplates();
    }
  }, [open, inspectionType]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("inspection_templates")
      .select("id, name, type")
      .eq("type", inspectionType)
      .order("name");

    if (error) {
      toast.error("Failed to load templates");
      return;
    }

    setTemplates(data || []);
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all rooms for the template
      const { data: rooms, error: roomsError } = await supabase
        .from("template_rooms")
        .select("*")
        .eq("template_id", selectedTemplate)
        .order("order_index");

      if (roomsError) throw roomsError;

      // For each room, fetch items and create subtasks
      for (const room of rooms || []) {
        const { data: items, error: itemsError } = await supabase
          .from("template_items")
          .select("*")
          .eq("room_id", room.id)
          .order("order_index");

        if (itemsError) continue;

        // Create subtasks from items
        const subtasks = (items || []).map(item => ({
          inspection_id: inspectionId,
          original_inspection_id: inspectionId,
          description: item.description,
          created_by: user.id,
        }));

        if (subtasks.length > 0) {
          const { error: insertError } = await supabase
            .from("subtasks")
            .insert(subtasks);

          if (insertError) {
            console.error("Failed to create subtasks for room:", room.name, insertError);
          }
        }
      }

      toast.success("Template applied successfully");
      onTemplateApplied?.();
      onOpenChange(false);
      setSelectedTemplate("");
    } catch (error: any) {
      toast.error(error.message || "Failed to apply template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Apply Inspection Template
          </DialogTitle>
          <DialogDescription>
            Select a template to create subtasks for this {inspectionType} inspection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No templates found for {inspectionType}
            </p>
          ) : (
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={applyTemplate} disabled={!selectedTemplate || loading}>
            {loading ? "Applying..." : "Apply Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
