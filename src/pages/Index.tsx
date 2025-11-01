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
import type { User, Session } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

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
        // Parse date string as local date to avoid timezone shifts
        const [year, month, day] = item.date.split('-').map(Number);
        return {
          id: item.id,
          type: item.type,
          date: new Date(year, month - 1, day),
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
      // Upload attachment if provided
      let attachmentUrl: string | undefined;
      if (newInspection.attachment) {
        const fileExt = newInspection.attachment.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, newInspection.attachment);

        if (uploadError) {
          console.error("Attachment upload error:", uploadError);
          toast.error("Failed to upload attachment");
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("attachments")
          .getPublicUrl(fileName);

        attachmentUrl = publicUrl;
      }

      const { error } = await supabase.from("inspections").insert({
        type: newInspection.type,
        date: format(newInspection.date, 'yyyy-MM-dd'),
        time: newInspection.time,
        property_id: newInspection.property.id,
        unit_id: newInspection.unitId && newInspection.unitId !== "none" ? newInspection.unitId : null,
        attachment_url: attachmentUrl,
        created_by: user.id,
      });

      if (error) {
        console.error("Insert inspection error:", error);
        toast.error(`Failed to add inspection: ${error.message}`);
        return;
      }

      toast.success("Inspection added successfully");
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
    // Find inspections on this date and open the first one
    const dayInspections = inspections.filter((inspection) =>
      inspection.date.toDateString() === date.toDateString()
    );

    if (dayInspections.length > 0) {
      setSelectedInspectionId(dayInspections[0].id);
      setDetailsDialogOpen(true);
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
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/tasks")}
              >
                My Tasks
              </Button>
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4 mr-2" />
                  Week
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

      <InspectionDetailsDialog
        inspectionId={selectedInspectionId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
};

export default Index;
