import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Home, Edit2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Property {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
  property_id: string;
  floorplan_id: string | null;
  floorplan?: { name: string } | null;
}

interface Floorplan {
  id: string;
  name: string;
}

export default function Properties() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, Unit[]>>({});
  const [floorplans, setFloorplans] = useState<Floorplan[]>([]);
  
  // Property dialog state
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  
  // Unit dialog state
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [unitName, setUnitName] = useState("");
  const [selectedFloorplanId, setSelectedFloorplanId] = useState("");
  const [newFloorplanName, setNewFloorplanName] = useState("");
  
  // Delete confirmation state
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<string | null>(null);
  const [cascadeDeleteProperty, setCascadeDeleteProperty] = useState<{
    propertyId: string;
    units: number;
    inspections: number;
  } | null>(null);
  const [cascadeDeleteUnit, setCascadeDeleteUnit] = useState<{
    unitId: string;
    inspections: number;
  } | null>(null);

  useEffect(() => {
    fetchProperties();
    fetchFloorplans();
  }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load properties");
      return;
    }

    setProperties(data || []);
    
    // Fetch units for each property
    if (data) {
      data.forEach(property => fetchUnitsForProperty(property.id));
    }
  };

  const fetchUnitsForProperty = async (propertyId: string) => {
    const { data, error } = await supabase
      .from("units")
      .select(`
        *,
        floorplan:floorplans(name)
      `)
      .eq("property_id", propertyId);

    if (!error && data) {
      // Sort units using natural/numeric sorting
      const sortedData = [...data].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });
      
      setUnitsByProperty(prev => ({
        ...prev,
        [propertyId]: sortedData
      }));
    }
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

  const openPropertyDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setPropertyName(property.name);
      setPropertyAddress(property.address);
    } else {
      setEditingProperty(null);
      setPropertyName("");
      setPropertyAddress("");
    }
    setShowPropertyDialog(true);
  };

  const saveProperty = async () => {
    if (!propertyName.trim() || !propertyAddress.trim()) {
      toast.error("Please enter property name and address");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingProperty) {
      // Update existing property
      const { error } = await supabase
        .from("properties")
        .update({
          name: propertyName,
          address: propertyAddress,
        })
        .eq("id", editingProperty.id);

      if (error) {
        toast.error("Failed to update property");
        return;
      }

      toast.success("Property updated");
    } else {
      // Create new property
      const { error } = await supabase
        .from("properties")
        .insert({
          name: propertyName,
          address: propertyAddress,
          created_by: user.id,
        });

      if (error) {
        toast.error("Failed to create property");
        return;
      }

      toast.success("Property created");
    }

    setShowPropertyDialog(false);
    fetchProperties();
  };

  const deleteProperty = async (cascade = false) => {
    if (!deletePropertyId) return;

    // Check for related records
    const { data: units } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", deletePropertyId);

    const { data: inspections } = await supabase
      .from("inspections")
      .select("id")
      .eq("property_id", deletePropertyId);

    const unitsCount = units?.length || 0;
    const inspectionsCount = inspections?.length || 0;

    if ((unitsCount > 0 || inspectionsCount > 0) && !cascade) {
      setCascadeDeleteProperty({
        propertyId: deletePropertyId,
        units: unitsCount,
        inspections: inspectionsCount,
      });
      setDeletePropertyId(null);
      return;
    }

    // Delete associated subtasks and inspections
    const inspectionIds = (inspections || []).map(i => i.id);
    if (inspectionIds.length > 0) {
      const { error: subtasksError } = await supabase
        .from("subtasks")
        .delete()
        .in("inspection_id", inspectionIds);
      if (subtasksError) {
        console.error("Delete subtasks error:", subtasksError);
        toast.error("Failed to delete associated subtasks: " + subtasksError.message);
        return;
      }

      const { error: inspectionsError } = await supabase
        .from("inspections")
        .delete()
        .in("id", inspectionIds);
      if (inspectionsError) {
        console.error("Delete inspections error:", inspectionsError);
        toast.error("Failed to delete associated inspections: " + inspectionsError.message);
        return;
      }
    }

    // Delete associated units
    if (units && units.length > 0) {
      await supabase
        .from("units")
        .delete()
        .eq("property_id", deletePropertyId);
    }

    // Delete template associations
    await supabase
      .from("template_properties")
      .delete()
      .eq("property_id", deletePropertyId);

    // Now delete the property
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", deletePropertyId);

    if (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete property: " + error.message);
      return;
    }

    setProperties(properties.filter(p => p.id !== deletePropertyId));
    const newUnitsByProperty = { ...unitsByProperty };
    delete newUnitsByProperty[deletePropertyId];
    setUnitsByProperty(newUnitsByProperty);
    setDeletePropertyId(null);
    toast.success("Property deleted");
  };

  const openUnitDialog = (propertyId: string, unit?: Unit) => {
    setSelectedPropertyId(propertyId);
    if (unit) {
      setEditingUnit(unit);
      setUnitName(unit.name);
      setSelectedFloorplanId(unit.floorplan_id || "");
    } else {
      setEditingUnit(null);
      setUnitName("");
      setSelectedFloorplanId("");
    }
    setNewFloorplanName("");
    setShowUnitDialog(true);
  };

  const saveUnit = async () => {
    if (!unitName.trim()) {
      toast.error("Please enter unit name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let floorplanId = selectedFloorplanId || null;

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

    if (editingUnit) {
      // Update existing unit
      const { error } = await supabase
        .from("units")
        .update({
          name: unitName,
          floorplan_id: floorplanId,
        })
        .eq("id", editingUnit.id);

      if (error) {
        toast.error("Failed to update unit");
        return;
      }

      toast.success("Unit updated");
    } else {
      // Create new unit
      const { error } = await supabase
        .from("units")
        .insert({
          name: unitName,
          property_id: selectedPropertyId,
          floorplan_id: floorplanId,
          created_by: user.id,
        });

      if (error) {
        toast.error("Failed to create unit");
        return;
      }

      toast.success("Unit created");
    }

    setShowUnitDialog(false);
    fetchUnitsForProperty(selectedPropertyId);
  };

  const deleteUnit = async (cascade = false) => {
    if (!deleteUnitId) return;

    // Check for related inspections
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id")
      .eq("unit_id", deleteUnitId);

    const inspectionsCount = inspections?.length || 0;

    if (inspectionsCount > 0 && !cascade) {
      setCascadeDeleteUnit({
        unitId: deleteUnitId,
        inspections: inspectionsCount,
      });
      setDeleteUnitId(null);
      return;
    }

    // Delete associated subtasks and inspections
    const unitInspectionIds = (inspections || []).map(i => i.id);
    if (unitInspectionIds.length > 0) {
      const { error: unitSubtasksError } = await supabase
        .from("subtasks")
        .delete()
        .in("inspection_id", unitInspectionIds);
      if (unitSubtasksError) {
        console.error("Delete subtasks error:", unitSubtasksError);
        toast.error("Failed to delete associated subtasks: " + unitSubtasksError.message);
        return;
      }

      const { error: unitInspectionsError } = await supabase
        .from("inspections")
        .delete()
        .in("id", unitInspectionIds);
      if (unitInspectionsError) {
        console.error("Delete inspections error:", unitInspectionsError);
        toast.error("Failed to delete associated inspections: " + unitInspectionsError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("units")
      .delete()
      .eq("id", deleteUnitId);

    if (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete unit: " + error.message);
      return;
    }

    // Update local state
    const propertyId = Object.keys(unitsByProperty).find(pid => 
      unitsByProperty[pid].some(u => u.id === deleteUnitId)
    );
    
    if (propertyId) {
      setUnitsByProperty(prev => ({
        ...prev,
        [propertyId]: prev[propertyId].filter(u => u.id !== deleteUnitId)
      }));
    }

    setDeleteUnitId(null);
    toast.success("Unit deleted");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Property & Unit Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/import-properties')}>
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </Button>
          <Button onClick={() => openPropertyDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Property
          </Button>
        </div>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first property
            </p>
            <Button onClick={() => openPropertyDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Create Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {properties.map((property) => (
            <AccordionItem key={property.id} value={property.id} className="border rounded-lg">
              <Card>
                <AccordionTrigger className="hover:no-underline px-6">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{property.name}</h3>
                        <p className="text-sm text-muted-foreground">{property.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPropertyDialog(property)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePropertyId(property.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Units ({unitsByProperty[property.id]?.length || 0})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openUnitDialog(property.id)}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add Unit
                      </Button>
                    </div>
                    
                    {!unitsByProperty[property.id] || unitsByProperty[property.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No units added yet
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unitsByProperty[property.id].map((unit) => (
                          <Card key={unit.id} className="bg-muted/50">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-medium">{unit.name}</p>
                                  {unit.floorplan && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Floorplan: {unit.floorplan.name}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openUnitDialog(property.id, unit)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setDeleteUnitId(unit.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Property Dialog */}
      <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProperty ? "Edit Property" : "New Property"}
            </DialogTitle>
            <DialogDescription>
              {editingProperty 
                ? "Update the property details below" 
                : "Enter the details for the new property"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="property-name">Property Name *</Label>
              <Input
                id="property-name"
                placeholder="e.g., Sunset Apartments"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="property-address">Address *</Label>
              <Input
                id="property-address"
                placeholder="e.g., 123 Main St, City, State 12345"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPropertyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveProperty}>
              {editingProperty ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Edit Unit" : "New Unit"}
            </DialogTitle>
            <DialogDescription>
              {editingUnit 
                ? "Update the unit details below" 
                : "Enter the details for the new unit"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="unit-name">Unit Name *</Label>
              <Input
                id="unit-name"
                placeholder="e.g., Unit 101, Apt A, etc."
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="floorplan">Floorplan (Optional)</Label>
              <Select 
                value={selectedFloorplanId} 
                onValueChange={(value) => {
                  setSelectedFloorplanId(value);
                  if (value) setNewFloorplanName("");
                }}
              >
                <SelectTrigger id="floorplan">
                  <SelectValue placeholder="Select existing floorplan" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="">No floorplan</SelectItem>
                  {floorplans.map((floorplan) => (
                    <SelectItem key={floorplan.id} value={floorplan.id}>
                      {floorplan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-floorplan">Or Create New Floorplan</Label>
              <Input
                id="new-floorplan"
                placeholder="New floorplan name..."
                value={newFloorplanName}
                onChange={(e) => {
                  setNewFloorplanName(e.target.value);
                  if (e.target.value) setSelectedFloorplanId("");
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveUnit}>
              {editingUnit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Property Confirmation */}
      <AlertDialog open={!!deletePropertyId} onOpenChange={() => setDeletePropertyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this property? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteProperty()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Unit Confirmation */}
      <AlertDialog open={!!deleteUnitId} onOpenChange={() => setDeleteUnitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this unit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteUnit()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cascade Delete Property Confirmation */}
      <AlertDialog open={!!cascadeDeleteProperty} onOpenChange={() => setCascadeDeleteProperty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property with Associations</AlertDialogTitle>
            <AlertDialogDescription>
              This property has associated records that will also be deleted:
              {cascadeDeleteProperty && (
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {cascadeDeleteProperty.units > 0 && (
                    <li>{cascadeDeleteProperty.units} unit(s)</li>
                  )}
                  {cascadeDeleteProperty.inspections > 0 && (
                    <li>{cascadeDeleteProperty.inspections} inspection(s)</li>
                  )}
                </ul>
              )}
              <p className="mt-3 font-semibold">Do you want to proceed with deleting everything?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCascadeDeleteProperty(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (cascadeDeleteProperty) {
                  setDeletePropertyId(cascadeDeleteProperty.propertyId);
                  setCascadeDeleteProperty(null);
                  setTimeout(() => deleteProperty(true), 0);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cascade Delete Unit Confirmation */}
      <AlertDialog open={!!cascadeDeleteUnit} onOpenChange={() => setCascadeDeleteUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit with Associations</AlertDialogTitle>
            <AlertDialogDescription>
              This unit has {cascadeDeleteUnit?.inspections} associated inspection(s) that will also be deleted.
              <p className="mt-3 font-semibold">Do you want to proceed with deleting everything?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCascadeDeleteUnit(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (cascadeDeleteUnit) {
                  setDeleteUnitId(cascadeDeleteUnit.unitId);
                  setCascadeDeleteUnit(null);
                  setTimeout(() => deleteUnit(true), 0);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
