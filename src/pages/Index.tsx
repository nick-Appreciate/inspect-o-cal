import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, LogOut, Calendar as CalendarIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import InspectionCalendar from "@/components/InspectionCalendar";
import WeeklyCalendar from "@/components/WeeklyCalendar";
import AddInspectionDialog from "@/components/AddInspectionDialog";
import InspectionDetailsDialog from "@/components/InspectionDetailsDialog";
import { Inspection, Property } from "@/types/inspection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { User, Session } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [dayDialogInspections, setDayDialogInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchInspections();
      fetchProperties();
    }
  }, [user]);

  useEffect(() => {
    const handleOpenInspectionDetails = (event: CustomEvent) => {
      const { inspectionId } = event.detail;
      setSelectedInspectionId(inspectionId);
      setDetailsDialogOpen(true);
    };

    window.addEventListener('openInspectionDetails' as any, handleOpenInspectionDetails);
    return () => {
      window.removeEventListener('openInspectionDetails' as any, handleOpenInspectionDetails);
    };
  }, []);

  const fetchInspections = async () => {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, properties(id, name, address), units(id, name)")
        .order("date", { ascending: true });

      if (error) {
        console.error("Failed to load inspections:", error);
        toast.error("Failed to load inspections");
        return;
      }

      if (!data) {
        setInspections([]);
        return;
      }

      const transformedData: Inspection[] = data.map((item: any) => {
        // Parse date string as midnight in America/Chicago timezone
        const dateInChicago = toZonedTime(`${item.date}T00:00:00`, 'America/Chicago');
        return {
          id: item.id,
          type: item.type,
          date: dateInChicago,
          time: item.time,
          duration: item.duration || 60,
          property: {
            id: item.properties.id,
            name: item.properties.name,
            address: item.properties.address,
          },
          attachmentUrl: item.attachment_url,
          unitId: item.units?.id,
          unitName: item.units?.name,
        };
      });
      setInspections(transformedData);
    } catch (err) {
      console.error("Error in fetchInspections:", err);
      toast.error("An error occurred while loading inspections");
    }
  };

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (error) {
      console.error("Failed to load properties:", error);
    } else {
      setProperties(data || []);
    }
  };

  const handleAddInspection = async (newInspection: Omit<Inspection, "id">) => {
    if (!user) return;

    try {
      // The inspection is created inside AddInspectionDialog (with checklist items and attachment handling).
      // Here we just refresh the list to reflect the new data.
      await fetchInspections();
    } catch (err: any) {
      console.error("Error in handleAddInspection:", err);
      toast.error(`An error occurred: ${err.message || "Unknown error"}`);
    }
  };

  const handleAddProperty = async (newProperty: Omit<Property, "id">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("properties")
      .insert({
        name: newProperty.name,
        address: newProperty.address,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add property");
    } else {
      toast.success("Property added successfully");
      setProperties([...properties, data]);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDateClick = (date: Date) => {
    const clicked = formatInTimeZone(date, 'America/Chicago', 'yyyy-MM-dd');
    const dayInspections = inspections.filter((inspection) =>
      formatInTimeZone(inspection.date, 'America/Chicago', 'yyyy-MM-dd') === clicked
    );

    if (dayInspections.length === 1) {
      setSelectedInspectionId(dayInspections[0].id);
      setDetailsDialogOpen(true);
    } else if (dayInspections.length > 1) {
      setDayDialogInspections(dayInspections);
      setDayDialogOpen(true);
    }
  };

  const handleInspectionClick = (inspectionId: string) => {
    setSelectedInspectionId(inspectionId);
    setDetailsDialogOpen(true);
  };

  const handleInspectionUpdate = () => {
    fetchInspections();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary rounded-lg">
                <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Inspections Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Manage and schedule property inspections
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate("/tasks")}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                My Tasks
              </Button>
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none text-xs sm:text-sm"
                >
                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Month</span>
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-l-none text-xs sm:text-sm"
                >
                  <List className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Week</span>
                </Button>
              </div>
              <AddInspectionDialog
                properties={properties}
                onAddInspection={handleAddInspection}
                onAddProperty={handleAddProperty}
              />
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {viewMode === "month" ? (
          <InspectionCalendar 
            inspections={inspections} 
            onDateClick={handleDateClick}
            onInspectionClick={handleInspectionClick}
          />
        ) : (
          <WeeklyCalendar
            inspections={inspections}
            onDateClick={handleDateClick}
            onInspectionUpdate={handleInspectionUpdate}
            onInspectionClick={handleInspectionClick}
          />
        )}
      </main>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Select an inspection</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {dayDialogInspections.map((insp) => (
              <button
                key={insp.id}
                className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
                onClick={() => {
                  setDayDialogOpen(false);
                  setSelectedInspectionId(insp.id);
                  setDetailsDialogOpen(true);
                }}
              >
                <div className="font-medium">{insp.time} - {insp.property.name}{insp.unitName ? ` (${insp.unitName})` : ""}</div>
                <div className="text-sm text-muted-foreground">{insp.type}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <InspectionDetailsDialog
        inspectionId={selectedInspectionId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
};

export default Index;
