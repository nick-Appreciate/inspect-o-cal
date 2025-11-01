import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

interface Inspection {
  id: string;
  type: string;
  date: string;
  time: string;
  property: {
    name: string;
    address: string;
  };
  unit?: {
    name: string;
  };
}

const Inspections = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, properties(name, address), units(name)")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) {
        console.error("Failed to load inspections:", error);
        toast.error("Failed to load inspections");
        return;
      }

      const transformedData: Inspection[] = (data || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        date: item.date,
        time: item.time,
        property: {
          name: item.properties.name,
          address: item.properties.address,
        },
        unit: item.units ? { name: item.units.name } : undefined,
      }));

      setInspections(transformedData);
    } catch (err) {
      console.error("Error fetching inspections:", err);
      toast.error("An error occurred while loading inspections");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("inspections")
        .delete()
        .eq("id", deleteId);

      if (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete inspection");
        return;
      }

      toast.success("Inspection deleted successfully");
      setInspections(inspections.filter((i) => i.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error("Error deleting inspection:", err);
      toast.error("An error occurred while deleting");
    }
  };

  const getInspectionColor = (type: string) => {
    const colors: { [key: string]: string } = {
      "S8 - RFT": "bg-blue-500",
      "S8 - 1st Annual": "bg-green-500",
      "S8 - Reinspection": "bg-yellow-500",
      "S8 - Abatement Cure": "bg-orange-500",
      "Rental License": "bg-purple-500",
      "HUD": "bg-pink-500",
    };
    return colors[type] || "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading inspections...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">All Inspections</h1>
              <p className="text-sm text-muted-foreground">
                View and manage all scheduled inspections
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">No inspections found</p>
            <Button onClick={() => navigate("/")}>
              Go to Calendar
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell>
                      <Badge className={getInspectionColor(inspection.type)}>
                        {inspection.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(inspection.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{inspection.time}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inspection.property.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {inspection.property.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inspection.unit ? (
                        <span className="text-sm">{inspection.unit.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(inspection.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inspection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inspections;
