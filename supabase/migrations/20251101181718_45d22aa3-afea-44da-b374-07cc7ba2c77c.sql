-- Allow all authenticated users to update any inspection (mark complete, etc.)
ALTER POLICY "Users can update their inspections"
ON public.inspections
USING (true);