-- Allow all authenticated users to delete any inspection
ALTER POLICY "Users can delete their inspections"
ON public.inspections
USING (true);
