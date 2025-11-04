import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Unit {
  id: string;
  name: string;
  floorplan?: { name: string } | null;
}

interface Template {
  id: string;
  name: string;
}

interface MultiUnitTemplateSelectorProps {
  units: Unit[];
  selectedUnits: string[];
  unitTemplates: Record<string, string>;
  onUnitSelection: (unitId: string) => void;
  onTemplateForUnit: (unitId: string, templateId: string) => void;
  fetchTemplatesForUnit: (unitId: string | null) => Promise<Template[]>;
}

export default function MultiUnitTemplateSelector({
  units,
  selectedUnits,
  unitTemplates,
  onUnitSelection,
  onTemplateForUnit,
  fetchTemplatesForUnit,
}: MultiUnitTemplateSelectorProps) {
  const [templatesForUnits, setTemplatesForUnits] = useState<Record<string, Template[]>>({});

  // Fetch templates when units are selected
  useEffect(() => {
    const fetchAllTemplates = async () => {
      const allUnitsToFetch = ["entire-property", ...selectedUnits];
      const newTemplates: Record<string, Template[]> = {};
      
      for (const unitId of allUnitsToFetch) {
        const templates = await fetchTemplatesForUnit(unitId === "entire-property" ? "entire-property" : unitId);
        newTemplates[unitId] = templates;
      }
      
      setTemplatesForUnits(newTemplates);
    };

    if (selectedUnits.length > 0 || selectedUnits.includes("entire-property")) {
      fetchAllTemplates();
    }
  }, [selectedUnits, fetchTemplatesForUnit]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Select Units and Templates</Label>
        <p className="text-sm text-muted-foreground">
          Choose which units to inspect and assign a template to each
        </p>

        {/* Entire Property Option */}
        <div className="space-y-3 p-4 border rounded-lg bg-accent/30">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="entire-property"
              checked={selectedUnits.includes("entire-property")}
              onCheckedChange={() => onUnitSelection("entire-property")}
            />
            <Label htmlFor="entire-property" className="font-medium cursor-pointer">
              Entire Property
            </Label>
          </div>
          
          {selectedUnits.includes("entire-property") && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="template-entire-property" className="text-sm">
                Select Template
              </Label>
              <Select
                value={unitTemplates["entire-property"] || ""}
                onValueChange={(value) => onTemplateForUnit("entire-property", value)}
              >
                <SelectTrigger id="template-entire-property">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50 border shadow-lg">
                  {templatesForUnits["entire-property"]?.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">
                      No templates available
                    </div>
                  )}
                  {templatesForUnits["entire-property"]?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Individual Units */}
        {units.map((unit) => (
          <div key={unit.id} className="space-y-3 p-4 border rounded-lg bg-background">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={unit.id}
                checked={selectedUnits.includes(unit.id)}
                onCheckedChange={() => onUnitSelection(unit.id)}
              />
              <Label htmlFor={unit.id} className="font-medium cursor-pointer">
                {unit.name}
                {unit.floorplan && (
                  <span className="text-muted-foreground ml-2 font-normal">
                    ({unit.floorplan.name})
                  </span>
                )}
              </Label>
            </div>
            
            {selectedUnits.includes(unit.id) && (
              <div className="ml-6 space-y-2">
                <Label htmlFor={`template-${unit.id}`} className="text-sm">
                  Select Template
                </Label>
                <Select
                  value={unitTemplates[unit.id] || ""}
                  onValueChange={(value) => onTemplateForUnit(unit.id, value)}
                >
                  <SelectTrigger id={`template-${unit.id}`}>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 border shadow-lg">
                    {templatesForUnits[unit.id]?.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">
                        No templates available
                      </div>
                    )}
                    {templatesForUnits[unit.id]?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
