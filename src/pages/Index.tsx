import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import InspectionCalendar from "@/components/InspectionCalendar";
import AddInspectionDialog from "@/components/AddInspectionDialog";
import { Inspection, Property } from "@/types/inspection";

const Index = () => {
  const [inspections, setInspections] = useState<Inspection[]>([
    {
      id: "1",
      type: "S8 - RFT",
      date: new Date(2025, 9, 15),
      time: "10:00",
      property: {
        id: "p1",
        name: "Maple Apartments",
        address: "456 Maple Ave, Springfield",
      },
    },
    {
      id: "2",
      type: "S8 - 1st Annual",
      date: new Date(2025, 9, 15),
      time: "14:00",
      property: {
        id: "p2",
        name: "Oak Tower",
        address: "789 Oak St, Springfield",
      },
    },
  ]);

  const [properties, setProperties] = useState<Property[]>([
    {
      id: "p1",
      name: "Maple Apartments",
      address: "456 Maple Ave, Springfield",
    },
    {
      id: "p2",
      name: "Oak Tower",
      address: "789 Oak St, Springfield",
    },
    {
      id: "p3",
      name: "Pine Plaza",
      address: "321 Pine Rd, Springfield",
    },
  ]);

  const handleAddInspection = (newInspection: Omit<Inspection, "id">) => {
    const inspection: Inspection = {
      ...newInspection,
      id: Date.now().toString(),
    };
    setInspections([...inspections, inspection]);
  };

  const handleAddProperty = (newProperty: Omit<Property, "id">) => {
    const property: Property = {
      ...newProperty,
      id: Date.now().toString(),
    };
    setProperties([...properties, property]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <ClipboardCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Inspections Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Manage and schedule property inspections
                </p>
              </div>
            </div>
            <AddInspectionDialog
              properties={properties}
              onAddInspection={handleAddInspection}
              onAddProperty={handleAddProperty}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <InspectionCalendar inspections={inspections} />
      </main>
    </div>
  );
};

export default Index;
