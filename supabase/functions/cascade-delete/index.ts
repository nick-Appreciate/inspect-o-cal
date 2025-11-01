import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReqBody {
  type: 'property' | 'unit'
  id: string
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Require auth (bearer token from client). We don't use the token for perms (service role bypasses RLS),
    // but we still require a valid user to avoid public misuse.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) throw new Error('Unauthorized')

    const body = await req.json() as ReqBody
    if (!body?.type || !body?.id) throw new Error('Invalid request body')

    if (body.type === 'property') {
      const propertyId = body.id

      // Collect inspections linked to this property
      const { data: inspections, error: inspErr } = await supabase
        .from('inspections')
        .select('id')
        .eq('property_id', propertyId)

      if (inspErr) throw inspErr
      const inspIds = (inspections ?? []).map(i => i.id)

      if (inspIds.length > 0) {
        // Delete subtasks by inspection_id and original_inspection_id
        const { error: delSub1 } = await supabase
          .from('subtasks')
          .delete()
          .in('inspection_id', inspIds)
        if (delSub1) throw delSub1

        const { error: delSub2 } = await supabase
          .from('subtasks')
          .delete()
          .in('original_inspection_id', inspIds)
        if (delSub2) throw delSub2

        // Delete inspections
        const { error: delInsp } = await supabase
          .from('inspections')
          .delete()
          .in('id', inspIds)
        if (delInsp) throw delInsp
      }

      // Delete units for property
      const { error: delUnits } = await supabase
        .from('units')
        .delete()
        .eq('property_id', propertyId)
      if (delUnits) throw delUnits

      // Delete template associations
      const { error: delTplProps } = await supabase
        .from('template_properties')
        .delete()
        .eq('property_id', propertyId)
      if (delTplProps) throw delTplProps

      // Finally delete property
      const { error: delProp } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId)
      if (delProp) throw delProp

      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    if (body.type === 'unit') {
      const unitId = body.id

      // Collect inspections linked to this unit
      const { data: inspections, error: inspErr } = await supabase
        .from('inspections')
        .select('id')
        .eq('unit_id', unitId)
      if (inspErr) throw inspErr
      const inspIds = (inspections ?? []).map(i => i.id)

      if (inspIds.length > 0) {
        const { error: delSub1 } = await supabase
          .from('subtasks')
          .delete()
          .in('inspection_id', inspIds)
        if (delSub1) throw delSub1

        const { error: delSub2 } = await supabase
          .from('subtasks')
          .delete()
          .in('original_inspection_id', inspIds)
        if (delSub2) throw delSub2

        const { error: delInsp } = await supabase
          .from('inspections')
          .delete()
          .in('id', inspIds)
        if (delInsp) throw delInsp
      }

      const { error: delUnit } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId)
      if (delUnit) throw delUnit

      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unknown type' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (err) {
    console.error('cascade-delete error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})