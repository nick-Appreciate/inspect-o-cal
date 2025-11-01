import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ImportProperties() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-properties');

      if (error) throw error;

      setResult(data);
      toast.success("Properties imported successfully!");
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import properties");
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Import Properties from Rent Roll</CardTitle>
          <CardDescription>
            This will import all properties, units, and floorplan data from your rent roll CSV.
            Click the button below to start the import process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This import will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Create 11 properties with full addresses</li>
                <li>Create 248 units across all properties</li>
                <li>Create floorplan types (2/1, 3/2, 4/2, etc.)</li>
                <li>For Hilltop Townhomes: Add "Townhome" suffix to floorplans</li>
                <li>Skip duplicate entries if properties already exist</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleImport} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Importing..." : "Import Properties"}
          </Button>

          {result && (
            <Alert variant={result.error ? "destructive" : "default"}>
              {result.error ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {result.error}
                  </AlertDescription>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Import Complete!</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>{result.stats?.floorplansCreated} floorplan types created</li>
                      <li>{result.stats?.propertiesCreated} new properties created</li>
                      <li>{result.stats?.unitsCreated} units created</li>
                      <li>Total properties in system: {result.stats?.totalProperties}</li>
                    </ul>
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
