import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateBuilder } from "@/components/TemplateBuilder";
import { InventoryTypesDialog } from "@/components/InventoryTypesDialog";

interface Template {
  id: string;
  name: string;
  description: string | null;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("inspection_templates")
      .insert({
        name: newTemplateName,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create template");
      return;
    }

    setTemplates([data, ...templates]);
    setSelectedTemplate(data.id);
    setNewTemplateName("");
    setShowNewTemplate(false);
    toast.success("Template created");
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
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Template name..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTemplate()}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <Button onClick={createTemplate}>Create</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTemplate(false);
                  setNewTemplateName("");
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
