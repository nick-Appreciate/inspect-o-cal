import { useState, useEffect } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ArrowLeft, Search, ArrowUpDown, Check, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import InspectionDetailsDialog from "@/components/InspectionDetailsDialog";
import { InspectionHistoryDialog } from "@/components/InspectionHistoryDialog";
import { DeleteInspectionDialog } from "@/components/DeleteInspectionDialog";
import { CompleteInspectionDialog } from "@/components/CompleteInspectionDialog";
import { UnCompleteInspectionDialog } from "@/components/UnCompleteInspectionDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    id: string;
    name: string;
    address: string;
  };
  unit?: {
    id: string;
    name: string;
  };
  parent_inspection_id: string | null;
  completed: boolean;
}

type SortField = "type" | "date" | "time" | "property" | "unit";
type SortDirection = "asc" | "desc";

const Inspections = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<Inspection | null>(null);
  const [connectedInspectionsToDelete, setConnectedInspectionsToDelete] = useState<Inspection[]>([]);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [inspectionToComplete, setInspectionToComplete] = useState<Inspection | null>(null);
  const [connectedInspectionsToComplete, setConnectedInspectionsToComplete] = useState<Inspection[]>([]);
  const [unCompleteDialogOpen, setUnCompleteDialogOpen] = useState(false);
  const [inspectionToUnComplete, setInspectionToUnComplete] = useState<Inspection | null>(null);
  const [connectedInspectionsToUnComplete, setConnectedInspectionsToUnComplete] = useState<Inspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showCompleted, setShowCompleted] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(null);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, properties(id, name, address), units(id, name)")
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
          id: item.properties.id,
          name: item.properties.name,
          address: item.properties.address,
        },
        unit: item.units ? { id: item.units.id, name: item.units.name } : undefined,
        parent_inspection_id: item.parent_inspection_id,
        completed: item.completed || false,
      }));

      setInspections(transformedData);
    } catch (err) {
      console.error("Error fetching inspections:", err);
      toast.error("An error occurred while loading inspections");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    const deletingInspection = inspections.find(i => i.id === id);
    if (!deletingInspection) return;

    // Find connected inspections (children and parent)
    const connectedInspections = inspections.filter(i => 
      (i.parent_inspection_id === id) || // Children
      (deletingInspection.parent_inspection_id && i.id === deletingInspection.parent_inspection_id) || // Parent
      (deletingInspection.parent_inspection_id && i.parent_inspection_id === deletingInspection.parent_inspection_id && i.id !== id) // Siblings
    );

    setInspectionToDelete(deletingInspection);
    setConnectedInspectionsToDelete(connectedInspections);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (inspectionIdsToDelete: string[]) => {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .delete()
        .in("id", inspectionIdsToDelete)
        .select();

      if (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete inspection(s)");
        return;
      }

      if (!data || data.length === 0) {
        console.error("No inspection deleted - possibly due to permissions");
        toast.error("Cannot delete this inspection. You may not have permission.");
        return;
      }

      toast.success(
        data.length > 1 
          ? `${data.length} inspections deleted successfully` 
          : "Inspection deleted successfully"
      );
      setInspections(inspections.filter((i) => !inspectionIdsToDelete.includes(i.id)));
      fetchInspections(); // Refresh the list
    } catch (err) {
      console.error("Error deleting inspection:", err);
      toast.error("An error occurred while deleting");
    }
  };

  const handleToggleCompleteClick = async (inspectionId: string, currentCompleted: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const toggleInspection = inspections.find(i => i.id === inspectionId);
    if (!toggleInspection) return;

    // If marking as complete, check for connected incomplete inspections
    if (!currentCompleted) {
      console.log('Completing inspection:', {
        id: inspectionId,
        type: toggleInspection.type,
        parentId: toggleInspection.parent_inspection_id
      });

      const connectedInspections = inspections.filter(i => 
        ((i.parent_inspection_id === inspectionId) || // Children
        (toggleInspection.parent_inspection_id && i.id === toggleInspection.parent_inspection_id) || // Parent
        (toggleInspection.parent_inspection_id && i.parent_inspection_id === toggleInspection.parent_inspection_id && i.id !== inspectionId)) // Siblings
        && !i.completed // Only incomplete ones
      );

      console.log('Found connected incomplete inspections:', connectedInspections.map(i => ({
        id: i.id,
        type: i.type,
        date: i.date,
        parentId: i.parent_inspection_id
      })));

      if (connectedInspections.length > 0) {
        // Show dialog with checkboxes
        setInspectionToComplete(toggleInspection);
        setConnectedInspectionsToComplete(connectedInspections);
        setCompleteDialogOpen(true);
        return;
      }
    } else {
      // If marking as incomplete, check for connected completed inspections
      console.log('Uncompleting inspection:', {
        id: inspectionId,
        type: toggleInspection.type,
        parentId: toggleInspection.parent_inspection_id
      });

      const connectedInspections = inspections.filter(i => 
        ((i.parent_inspection_id === inspectionId) || // Children
        (toggleInspection.parent_inspection_id && i.id === toggleInspection.parent_inspection_id) || // Parent
        (toggleInspection.parent_inspection_id && i.parent_inspection_id === toggleInspection.parent_inspection_id && i.id !== inspectionId)) // Siblings
        && i.completed // Only completed ones
      );

      console.log('Found connected completed inspections:', connectedInspections.map(i => ({
        id: i.id,
        type: i.type,
        date: i.date,
        parentId: i.parent_inspection_id
      })));

      if (connectedInspections.length > 0) {
        // Show uncomplete dialog with checkboxes
        setInspectionToUnComplete(toggleInspection);
        setConnectedInspectionsToUnComplete(connectedInspections);
        setUnCompleteDialogOpen(true);
        return;
      }
    }
    
    // Simple toggle for individual inspection
    await handleToggleComplete(inspectionId, currentCompleted);
  };

  const handleToggleComplete = async (inspectionId: string, currentCompleted: boolean) => {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .update({ completed: !currentCompleted })
        .eq("id", inspectionId)
        .select("id, completed");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Cannot update this inspection. You may not have permission.");
        return;
      }

      setInspections(prev =>
        prev.map(i => i.id === inspectionId ? { ...i, completed: !currentCompleted } : i)
      );
      toast.success(`Inspection marked as ${!currentCompleted ? "complete" : "incomplete"}`);
    } catch (err) {
      console.error("Error updating inspection:", err);
      toast.error("An error occurred");
    }
  };

  const handleCompleteConfirm = async (inspectionIdsToComplete: string[]) => {
    console.log('handleCompleteConfirm - IDs to complete:', inspectionIdsToComplete);
    try {
      const { data, error } = await supabase
        .from("inspections")
        .update({ completed: true })
        .in("id", inspectionIdsToComplete)
        .select("id");

      if (error) {
        console.error('Update error:', error);
        toast.error("Failed to update inspections");
        return;
      }

      const updatedIds = new Set((data || []).map((d: any) => d.id));
      const notUpdated = inspectionIdsToComplete.filter(id => !updatedIds.has(id));

      if (notUpdated.length > 0) {
        toast.warning(`${notUpdated.length} inspection(s) could not be completed due to permissions`);
      }

      setInspections(prev => 
        prev.map(i => updatedIds.has(i.id) ? { ...i, completed: true } : i)
      );
      toast.success(
        (data?.length || 0) > 1 
          ? `${data?.length} inspections marked as complete` 
          : "Inspection marked as complete"
      );
      if (!showCompleted) {
        toast("Completed inspections are hidden. Use 'Show Completed' to view them.");
      }
      fetchInspections(); // Refresh the list
    } catch (err) {
      console.error("Error updating inspections:", err);
      toast.error("An error occurred");
    }
  };

  const handleUnCompleteConfirm = async (inspectionIdsToUncomplete: string[]) => {
    console.log('handleUnCompleteConfirm - IDs to uncomplete:', inspectionIdsToUncomplete);
    try {
      const { data, error } = await supabase
        .from("inspections")
        .update({ completed: false })
        .in("id", inspectionIdsToUncomplete)
        .select("id");

      if (error) {
        console.error('Update error:', error);
        toast.error("Failed to update inspections");
        return;
      }

      const updatedIds = new Set((data || []).map((d: any) => d.id));
      const notUpdated = inspectionIdsToUncomplete.filter(id => !updatedIds.has(id));

      if (notUpdated.length > 0) {
        toast.warning(`${notUpdated.length} inspection(s) could not be marked incomplete due to permissions`);
      }

      setInspections(prev => 
        prev.map(i => updatedIds.has(i.id) ? { ...i, completed: false } : i)
      );
      toast.success(
        (data?.length || 0) > 1 
          ? `${data?.length} inspections marked as incomplete` 
          : "Inspection marked as incomplete"
      );
      fetchInspections(); // Refresh the list
    } catch (err) {
      console.error("Error updating inspections:", err);
      toast.error("An error occurred");
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const hasFollowUpInFutureOrToday = (inspectionId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return inspections.some(insp => {
      if (insp.parent_inspection_id !== inspectionId) return false;
      const inspDate = new Date(insp.date);
      inspDate.setHours(0, 0, 0, 0);
      return inspDate >= today;
    });
  };

  const isInspectionPast = (dateString: string, inspectionId: string) => {
    const inspectionDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    inspectionDate.setHours(0, 0, 0, 0);
    
    if (inspectionDate >= today) return false;
    return !hasFollowUpInFutureOrToday(inspectionId);
  };

  const filteredInspections = inspections.filter((inspection) => {
    // Filter by completed status
    if (!showCompleted && inspection.completed) return false;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const searchableText = [
      inspection.type,
      format(new Date(inspection.date), "MMM d, yyyy"),
      inspection.time,
      inspection.property.name,
      inspection.property.address,
      inspection.unit?.name || "",
    ].join(" ").toLowerCase();

    return searchableText.includes(query);
  });

  // Build inspection chains first (before sorting)
  const buildInspectionChains = (inspections: Inspection[]) => {
    const chains: Inspection[][] = [];
    const processed = new Set<string>();

    const findChain = (inspection: Inspection): Inspection[] => {
      const chain: Inspection[] = [inspection];
      processed.add(inspection.id);

      // Find all follow-ups
      const followUps = inspections.filter(i => i.parent_inspection_id === inspection.id);
      for (const followUp of followUps) {
        if (!processed.has(followUp.id)) {
          chain.push(...findChain(followUp));
        }
      }

      return chain;
    };

    // Start with root inspections (no parent)
    const rootInspections = inspections.filter(i => !i.parent_inspection_id);
    for (const root of rootInspections) {
      if (!processed.has(root.id)) {
        chains.push(findChain(root));
      }
    }

    // Handle orphaned inspections
    for (const inspection of inspections) {
      if (!processed.has(inspection.id)) {
        chains.push([inspection]);
        processed.add(inspection.id);
      }
    }

    return chains;
  };

  // Build all chains first
  const allChains = buildInspectionChains(filteredInspections);

  // Sort chains based on their first inspection
  const sortedChains = [...allChains].sort((chainA, chainB) => {
    const a = chainA[0];
    const b = chainB[0];
    let compareA: any;
    let compareB: any;

    switch (sortField) {
      case "type":
        compareA = a.type;
        compareB = b.type;
        break;
      case "date":
        compareA = new Date(a.date).getTime();
        compareB = new Date(b.date).getTime();
        break;
      case "time":
        compareA = a.time;
        compareB = b.time;
        break;
      case "property":
        compareA = a.property.name;
        compareB = b.property.name;
        break;
      case "unit":
        compareA = a.unit?.name || "";
        compareB = b.unit?.name || "";
        break;
      default:
        return 0;
    }

    if (compareA < compareB) return sortDirection === "asc" ? -1 : 1;
    if (compareA > compareB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Group sorted chains by property
  const groupedByProperty = sortedChains.reduce((acc, chain) => {
    const propertyId = chain[0].property.id;
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: chain[0].property,
        chains: [],
      };
    }
    acc[propertyId].chains.push(chain);
    return acc;
  }, {} as Record<string, { property: { id: string; name: string; address: string }; chains: Inspection[][] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading inspections...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">All Inspections</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                View and manage all scheduled inspections
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">No inspections found</p>
            <Button onClick={() => navigate("/")}>
              Go to Calendar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by type, date, property, unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showCompleted ? "default" : "outline"}
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full sm:w-auto"
              >
                {showCompleted ? "Hide" : "Show"} Completed
              </Button>
            </div>

            {sortedChains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card">
                <p className="text-muted-foreground">No inspections match your search</p>
              </div>
            ) : (
              <>
                {/* Desktop: Table View */}
                <div className="hidden md:block rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={inspections.every(i => i.completed)}
                          onCheckedChange={(checked) => {
                            inspections.forEach(i => {
                              if (i.completed !== checked) {
                                handleToggleCompleteClick(i.id, i.completed, { stopPropagation: () => {} } as any);
                              }
                            });
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none min-w-[120px]"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center gap-2">
                          Type
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none min-w-[100px]"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center gap-2">
                          Date
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none min-w-[80px]"
                        onClick={() => handleSort("time")}
                      >
                        <div className="flex items-center gap-2">
                          Time
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none min-w-[150px]"
                        onClick={() => handleSort("property")}
                      >
                        <div className="flex items-center gap-2">
                          Property
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none min-w-[100px]"
                        onClick={() => handleSort("unit")}
                      >
                        <div className="flex items-center gap-2">
                          Unit
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedByProperty).map(([propertyId, { property, chains }]) => (
                      <React.Fragment key={propertyId}>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="font-semibold">
                            <div>
                              <div className="text-base">{property.name}</div>
                              <div className="text-sm text-muted-foreground font-normal">{property.address}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {chains.map((chain, chainIndex) => 
                          chain.map((inspection, idx) => {
                            const isPast = isInspectionPast(inspection.date, inspection.id);
                            return (
                              <TableRow 
                                key={inspection.id}
                                className={`cursor-pointer hover:bg-muted/50 ${
                                  isPast ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30" : ""
                                } ${inspection.completed ? "opacity-60" : ""} ${
                                  idx > 0 ? "border-l-4 border-l-primary/30" : ""
                                }`}
                                onClick={() => {
                                  setSelectedInspectionId(inspection.id);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <TableCell>
                                  <Checkbox 
                                    checked={inspection.completed}
                                    onCheckedChange={(checked) => handleToggleCompleteClick(inspection.id, inspection.completed, { stopPropagation: () => {} } as any)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {idx > 0 && (
                                      <span className="text-xs text-muted-foreground">└─</span>
                                    )}
                                    <Badge className={getInspectionColor(inspection.type)}>
                                      {inspection.type}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(inspection.date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{inspection.time}</TableCell>
                                <TableCell>
                                  {inspection.property.name}
                                </TableCell>
                                <TableCell>
                                  {inspection.unit ? (
                                    <span className="text-sm">{inspection.unit.name}</span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHistoryInspection(inspection);
                                        setHistoryDialogOpen(true);
                                      }}
                                      title="View History"
                                    >
                                      <History className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(inspection.id);
                                      }}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card View */}
              <div className="md:hidden space-y-4">
                {Object.entries(groupedByProperty).map(([propertyId, { property, chains }]) => (
                  <div key={propertyId} className="space-y-3">
                    {/* Property Header */}
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="font-semibold text-sm">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{property.address}</div>
                    </div>

                    {/* Inspections */}
                    {chains.map((chain) =>
                      chain.map((inspection, idx) => {
                        const isPast = isInspectionPast(inspection.date, inspection.id);
                        return (
                          <Card
                            key={inspection.id}
                            className={`cursor-pointer transition-colors ${
                              isPast ? "bg-red-50 dark:bg-red-950/20" : ""
                            } ${inspection.completed ? "opacity-60" : ""} ${
                              idx > 0 ? "border-l-4 border-l-primary/30 ml-4" : ""
                            }`}
                            onClick={() => {
                              setSelectedInspectionId(inspection.id);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <CardContent className="p-3 space-y-2">
                              {/* Checkbox and Type */}
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={inspection.completed}
                                  onCheckedChange={(checked) =>
                                    handleToggleCompleteClick(inspection.id, inspection.completed, {
                                      stopPropagation: () => {},
                                    } as any)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {idx > 0 && (
                                      <span className="text-xs text-muted-foreground">└─</span>
                                    )}
                                    <Badge className={getInspectionColor(inspection.type)}>
                                      {inspection.type}
                                    </Badge>
                                  </div>
                                  
                                  {/* Date and Time */}
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <div>
                                      📅 {format(new Date(inspection.date), "MMM d, yyyy")} at {inspection.time}
                                    </div>
                                    {inspection.unit && (
                                      <div>🏢 Unit: {inspection.unit.name}</div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHistoryInspection(inspection);
                                      setHistoryDialogOpen(true);
                                    }}
                                    title="View History"
                                  >
                                    <History className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(inspection.id);
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </>
            )}
          </div>
        )}
      </main>

      <InspectionDetailsDialog
        inspectionId={selectedInspectionId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <DeleteInspectionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        mainInspection={inspectionToDelete}
        connectedInspections={connectedInspectionsToDelete}
        onConfirm={handleDeleteConfirm}
      />

      <CompleteInspectionDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        mainInspection={inspectionToComplete}
        connectedInspections={connectedInspectionsToComplete}
        onConfirm={handleCompleteConfirm}
      />

      <UnCompleteInspectionDialog
        open={unCompleteDialogOpen}
        onOpenChange={setUnCompleteDialogOpen}
        mainInspection={inspectionToUnComplete}
        connectedInspections={connectedInspectionsToUnComplete}
        onConfirm={handleUnCompleteConfirm}
      />

      <InspectionHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        inspectionId={historyInspection?.id || ""}
        propertyId={historyInspection?.property.id}
        unitId={historyInspection?.unit?.id}
      />
    </div>
  );
};

export default Inspections;
