import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PropertyData {
  name: string;
  address: string;
  units: UnitData[];
}

interface UnitData {
  name: string;
  floorplan: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the authenticated user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Starting property import for user:', user.id);

    // Get request body to check if we should clear existing data
    const requestBody = await req.json().catch(() => ({ clearExisting: false }));
    const shouldClearExisting = requestBody.clearExisting === true;

    if (shouldClearExisting) {
      console.log('Clearing existing properties, units, and floorplans...');
      
      // Delete all units first (foreign key constraint)
      const { error: unitsDeleteError } = await supabase
        .from('units')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (unitsDeleteError) {
        console.log('Error deleting units (may not exist):', unitsDeleteError);
      }

      // Delete all properties
      const { error: propertiesDeleteError } = await supabase
        .from('properties')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (propertiesDeleteError) {
        console.log('Error deleting properties (may not exist):', propertiesDeleteError);
      }

      // Delete all floorplans
      const { error: floorplansDeleteError } = await supabase
        .from('floorplans')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (floorplansDeleteError) {
        console.log('Error deleting floorplans (may not exist):', floorplansDeleteError);
      }

      console.log('Existing data cleared successfully');
    }

    // Define all property data
    const propertyData: PropertyData[] = [
      {
        name: "1511 Sylvan Lane",
        address: "1511 Sylvan Lane Columbia, MO 65202",
        units: [
          { name: "A", floorplan: "2/1" },
          { name: "B", floorplan: "2/1" },
          { name: "C", floorplan: "2/1" },
          { name: "D", floorplan: "2/1" },
        ]
      },
      {
        name: "3909 North Oakland Gravel Road",
        address: "3909 North Oakland Gravel Road Columbia, MO 65202",
        units: [
          { name: "1", floorplan: "2/1" },
          { name: "2", floorplan: "2/1" },
          { name: "101", floorplan: "2/1" },
          { name: "102", floorplan: "2/1" },
          { name: "201", floorplan: "2/1" },
          { name: "202", floorplan: "2/1" },
        ]
      },
      {
        name: "407 Pecan Street",
        address: "407 Pecan Street Columbia, MO 65201",
        units: [
          { name: "1", floorplan: "1/1" },
          { name: "101", floorplan: "1/1" },
          { name: "102", floorplan: "1/1" },
          { name: "201", floorplan: "1/1" },
          { name: "202", floorplan: "1/1" },
        ]
      },
      {
        name: "801-803 Washington Avenue",
        address: "801-803 Washington Avenue Columbia, MO 65201",
        units: [
          { name: "801", floorplan: "2/1" },
          { name: "803", floorplan: "1/1" },
        ]
      },
      {
        name: "811 South Fairview Road",
        address: "811 South Fairview Road Columbia, MO 65203",
        units: [
          { name: "A", floorplan: "2/2" },
          { name: "B", floorplan: "2/2" },
        ]
      },
      {
        name: "Glen Oaks",
        address: "3050 N 58th St Kansas City, KS 66104",
        units: [
          { name: "1", floorplan: "2/1" },
          { name: "2", floorplan: "1/1" },
          { name: "3", floorplan: "2/1" },
          { name: "4", floorplan: "1/1" },
          { name: "5", floorplan: "2/1" },
          { name: "6", floorplan: "1/1" },
          { name: "7", floorplan: "2/1" },
          { name: "8", floorplan: "1/1" },
          { name: "9", floorplan: "2/1" },
          { name: "10", floorplan: "1/1" },
          { name: "11", floorplan: "2/1" },
          { name: "12", floorplan: "1/1" },
          { name: "13", floorplan: "2/1" },
          { name: "14", floorplan: "1/1" },
          { name: "15", floorplan: "2/1" },
          { name: "16", floorplan: "1/1" },
          { name: "17", floorplan: "2/1" },
          { name: "18", floorplan: "1/1" },
          { name: "19", floorplan: "2/1" },
          { name: "20", floorplan: "1/1" },
          { name: "21", floorplan: "2/1" },
          { name: "22", floorplan: "1/1" },
          { name: "23", floorplan: "2/1" },
          { name: "24", floorplan: "1/1" },
          { name: "25", floorplan: "2/1" },
          { name: "26", floorplan: "1/1" },
          { name: "27", floorplan: "2/1" },
          { name: "28", floorplan: "1/1" },
          { name: "29", floorplan: "2/1" },
          { name: "30", floorplan: "1/1" },
          { name: "31", floorplan: "2/1" },
          { name: "32", floorplan: "1/1" },
          { name: "33", floorplan: "2/1" },
          { name: "34", floorplan: "1/1" },
          { name: "35", floorplan: "2/1" },
          { name: "36", floorplan: "1/1" },
        ]
      },
      {
        name: "Hilltop Townhomes",
        address: "2420 Delavan Avenue Kansas City, KS 66104",
        units: [
          { name: "2600D", floorplan: "2/1 Townhome" },
          { name: "2601D", floorplan: "3/2 Townhome" },
          { name: "2601F", floorplan: "2/1 Townhome" },
          { name: "2602D", floorplan: "2/1 Townhome" },
          { name: "2603D", floorplan: "3/2 Townhome" },
          { name: "2603F", floorplan: "2/1 Townhome" },
          { name: "2604D", floorplan: "2/1 Townhome" },
          { name: "2605D", floorplan: "3/2 Townhome" },
          { name: "2605F", floorplan: "2/1 Townhome" },
          { name: "2606D", floorplan: "2/1 Townhome" },
          { name: "2607D", floorplan: "4/2 Townhome" },
          { name: "2607F", floorplan: "2/1 Townhome" },
          { name: "2608D", floorplan: "2/1 Townhome" },
          { name: "2609D", floorplan: "3/2 Townhome" },
          { name: "2609F", floorplan: "2/1 Townhome" },
          { name: "2610D", floorplan: "2/1 Townhome" },
          { name: "2611D", floorplan: "3/2 Townhome" },
          { name: "2611F", floorplan: "2/1 Townhome" },
          { name: "2612D", floorplan: "4/2 Townhome" },
          { name: "2613D", floorplan: "4/2 Townhome" },
          { name: "2613F", floorplan: "4/2 Townhome" },
          { name: "2614D", floorplan: "3/2 Townhome" },
          { name: "2615D", floorplan: "4/2 Townhome" },
          { name: "2615F", floorplan: "3/2 Townhome" },
          { name: "2620D", floorplan: "2/1 Townhome" },
          { name: "2621D", floorplan: "4/2 Townhome" },
          { name: "2621F", floorplan: "2/1 Townhome" },
          { name: "2622D", floorplan: "2/1 Townhome" },
          { name: "2623D", floorplan: "4/2 Townhome" },
          { name: "2623F", floorplan: "2/1 Townhome" },
          { name: "2624D", floorplan: "2/1 Townhome" },
          { name: "2625D", floorplan: "4/2 Townhome" },
          { name: "2625F", floorplan: "2/1 Townhome" },
          { name: "2626D", floorplan: "2/1 Townhome" },
          { name: "2627D", floorplan: "3/2 Townhome" },
          { name: "2627F", floorplan: "2/1 Townhome" },
          { name: "2628D", floorplan: "2/1 Townhome" },
          { name: "2629D", floorplan: "3/2 Townhome" },
          { name: "2629F", floorplan: "2/1 Townhome" },
          { name: "2630D", floorplan: "2/1 Townhome" },
          { name: "2631D", floorplan: "3/2 Townhome" },
          { name: "2631F", floorplan: "2/1 Townhome" },
          { name: "2632D", floorplan: "3/2 Townhome" },
          { name: "2633D", floorplan: "4/2 Townhome" },
          { name: "2633F", floorplan: "3/2 Townhome" },
          { name: "2634D", floorplan: "3/2 Townhome" },
          { name: "2635D", floorplan: "4/2 Townhome" },
          { name: "2635F", floorplan: "4/2 Townhome" },
          { name: "2636D", floorplan: "4/2 Townhome" },
          { name: "2637D", floorplan: "4/2 Townhome" },
          { name: "2637F", floorplan: "4/2 Townhome" },
        ]
      },
      {
        name: "Maple Manor Apartments",
        address: "1409 W Maple Ave Independence, MO 64050",
        units: [
          { name: "1409A", floorplan: "1/1" },
          { name: "1409B", floorplan: "1/1" },
          { name: "1409C", floorplan: "1/1" },
          { name: "1409D", floorplan: "1/1" },
          { name: "1409E", floorplan: "1/1" },
          { name: "1409F", floorplan: "1/1" },
          { name: "1409G", floorplan: "1/1" },
          { name: "1409H", floorplan: "1/1" },
          { name: "1411A", floorplan: "3/1" },
          { name: "1411B", floorplan: "3/1" },
          { name: "1411C", floorplan: "3/1" },
          { name: "1411D", floorplan: "3/1" },
          { name: "1411E", floorplan: "3/1" },
          { name: "1411F", floorplan: "3/1" },
          { name: "1411G", floorplan: "3/1" },
          { name: "1411H", floorplan: "3/1" },
          { name: "1413A", floorplan: "2/1" },
          { name: "1413B", floorplan: "2/1" },
          { name: "1413C", floorplan: "2/1" },
          { name: "1413D", floorplan: "2/1" },
          { name: "1413E", floorplan: "2/1" },
          { name: "1413F", floorplan: "2/1" },
          { name: "1413G", floorplan: "2/1" },
          { name: "1413H", floorplan: "2/1" },
          { name: "1413I", floorplan: "2/1" },
          { name: "1413J", floorplan: "2/1" },
          { name: "1413K", floorplan: "2/1" },
          { name: "1413L", floorplan: "2/1" },
          { name: "1415A", floorplan: "2/1" },
          { name: "1415B", floorplan: "2/1" },
          { name: "1415C", floorplan: "2/1" },
          { name: "1415D", floorplan: "2/1" },
          { name: "1415E", floorplan: "2/1" },
          { name: "1415F", floorplan: "2/1" },
          { name: "1415G", floorplan: "2/1" },
          { name: "1415H", floorplan: "2/1" },
          { name: "1415I", floorplan: "2/1" },
          { name: "1415J", floorplan: "2/1" },
          { name: "1415K", floorplan: "2/1" },
          { name: "1415L", floorplan: "2/1" },
        ]
      },
      {
        name: "Normandy Apartments",
        address: "1900 N 77th Street Kansas City, KS 66112",
        units: [
          { name: "1900-1", floorplan: "2/1" },
          { name: "1900-2", floorplan: "1/1" },
          { name: "1900-3", floorplan: "2/1" },
          { name: "1900-4", floorplan: "2/1" },
          { name: "1900-5", floorplan: "2/1" },
          { name: "1900-6", floorplan: "1/1" },
          { name: "1904-7", floorplan: "2/1" },
          { name: "1904-8", floorplan: "1/1" },
          { name: "1904-9", floorplan: "2/1" },
          { name: "1904-10", floorplan: "2/1" },
          { name: "1904-11", floorplan: "2/1" },
          { name: "1906-6", floorplan: "1/1" },
          { name: "1906-7", floorplan: "2/1" },
          { name: "1906-8", floorplan: "1/1" },
          { name: "1906-9", floorplan: "2/1" },
          { name: "1906-10", floorplan: "1/1" },
          { name: "1906-11", floorplan: "2/1" },
          { name: "1908-1", floorplan: "2/1" },
          { name: "1908-2", floorplan: "1/1" },
          { name: "1908-3", floorplan: "2/1" },
          { name: "1908-4", floorplan: "1/1" },
          { name: "1908-5", floorplan: "2/1" },
        ]
      },
      {
        name: "Oakwood Gardens",
        address: "3309 Wood Avenue Kansas City, KS 66102",
        units: [
          { name: "1", floorplan: "2/1" },
          { name: "2", floorplan: "1/1" },
          { name: "3", floorplan: "2/1" },
          { name: "4", floorplan: "2/1" },
          { name: "5", floorplan: "2/1" },
          { name: "6", floorplan: "2/1" },
          { name: "7", floorplan: "2/1" },
          { name: "8", floorplan: "2/1" },
          { name: "9", floorplan: "1/1" },
          { name: "10", floorplan: "2/1" },
          { name: "11", floorplan: "2/1" },
          { name: "12", floorplan: "2/1" },
          { name: "14", floorplan: "1/1" },
          { name: "15", floorplan: "2/1" },
          { name: "16", floorplan: "2/1" },
          { name: "17", floorplan: "2/1" },
          { name: "18", floorplan: "2/1" },
          { name: "19", floorplan: "1/1" },
          { name: "20", floorplan: "2/1" },
          { name: "21", floorplan: "2/1" },
          { name: "22", floorplan: "2/1" },
          { name: "23", floorplan: "1/1" },
          { name: "24", floorplan: "2/1" },
          { name: "25", floorplan: "2/1" },
          { name: "26", floorplan: "1/1" },
          { name: "27", floorplan: "2/1" },
          { name: "28", floorplan: "1/1" },
          { name: "29", floorplan: "2/1" },
          { name: "30", floorplan: "2/1" },
          { name: "31", floorplan: "2/1" },
          { name: "32", floorplan: "2/1" },
          { name: "33", floorplan: "1/1" },
          { name: "34", floorplan: "2/1" },
          { name: "35", floorplan: "2/1" },
          { name: "36", floorplan: "2/1" },
          { name: "37", floorplan: "2/1" },
          { name: "38", floorplan: "2/1" },
          { name: "39", floorplan: "1/1" },
          { name: "40", floorplan: "2/1" },
          { name: "41", floorplan: "2/1" },
          { name: "42", floorplan: "2/1" },
          { name: "43", floorplan: "2/1" },
          { name: "44", floorplan: "1/1" },
          { name: "45", floorplan: "2/1" },
          { name: "46", floorplan: "2/1" },
          { name: "47", floorplan: "2/1" },
          { name: "48", floorplan: "1/1" },
          { name: "49", floorplan: "2/1" },
          { name: "50", floorplan: "2/1" },
          { name: "51", floorplan: "1/1" },
        ]
      },
      {
        name: "Pioneer Apartments",
        address: "2408 Whitegate Drive Columbia, MO 65202",
        units: Array.from({ length: 30 }, (_, i) => ({
          name: String(i + 1),
          floorplan: "1/1"
        }))
      },
    ];

    // Step 1: Collect all unique floorplan names
    const floorplanNames = new Set<string>();
    propertyData.forEach(property => {
      property.units.forEach(unit => {
        floorplanNames.add(unit.floorplan);
      });
    });

    console.log('Creating floorplans:', Array.from(floorplanNames));

    // Step 2: Create or get floorplans
    const floorplanMap = new Map<string, string>();
    
    for (const floorplanName of floorplanNames) {
      // Check if floorplan already exists
      const { data: existing } = await supabase
        .from('floorplans')
        .select('id, name')
        .eq('name', floorplanName)
        .single();

      if (existing) {
        floorplanMap.set(floorplanName, existing.id);
        console.log(`Floorplan "${floorplanName}" already exists with ID ${existing.id}`);
      } else {
        // Create new floorplan
        const { data: newFloorplan, error: floorplanError } = await supabase
          .from('floorplans')
          .insert({
            name: floorplanName,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (floorplanError) {
          console.error(`Error creating floorplan "${floorplanName}":`, floorplanError);
          throw floorplanError;
        }

        floorplanMap.set(floorplanName, newFloorplan.id);
        console.log(`Created floorplan "${floorplanName}" with ID ${newFloorplan.id}`);
      }
    }

    // Step 3: Create properties and their units
    let totalPropertiesCreated = 0;
    let totalUnitsCreated = 0;

    for (const property of propertyData) {
      console.log(`Processing property: ${property.name}`);

      // Check if property already exists
      const { data: existingProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('name', property.name)
        .eq('address', property.address)
        .single();

      let propertyId: string;

      if (existingProperty) {
        propertyId = existingProperty.id;
        console.log(`Property "${property.name}" already exists with ID ${propertyId}`);
      } else {
        // Create property
        const { data: newProperty, error: propertyError } = await supabase
          .from('properties')
          .insert({
            name: property.name,
            address: property.address,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (propertyError) {
          console.error(`Error creating property "${property.name}":`, propertyError);
          throw propertyError;
        }

        propertyId = newProperty.id;
        totalPropertiesCreated++;
        console.log(`Created property "${property.name}" with ID ${propertyId}`);
      }

      // Create units for this property
      const unitsToInsert = property.units.map(unit => ({
        name: unit.name,
        property_id: propertyId,
        floorplan_id: floorplanMap.get(unit.floorplan),
        created_by: user.id,
      }));

      const { data: createdUnits, error: unitsError } = await supabase
        .from('units')
        .insert(unitsToInsert)
        .select('id');

      if (unitsError) {
        console.error(`Error creating units for property "${property.name}":`, unitsError);
        throw unitsError;
      }

      totalUnitsCreated += createdUnits.length;
      console.log(`Created ${createdUnits.length} units for property "${property.name}"`);
    }

    const summary = {
      success: true,
      message: 'Property import completed successfully',
      stats: {
        floorplansCreated: floorplanNames.size,
        propertiesCreated: totalPropertiesCreated,
        unitsCreated: totalUnitsCreated,
        totalProperties: propertyData.length,
      }
    };

    console.log('Import summary:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error importing properties:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
