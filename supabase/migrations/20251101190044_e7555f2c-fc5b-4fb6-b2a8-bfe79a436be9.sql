-- Fix: User Email Addresses Publicly Accessible
-- Create a view that exposes only non-sensitive profile fields for user selection/assignment
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update RLS policy on profiles to restrict email access
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Add comment for clarity
COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles without sensitive data like email addresses. Use this for user selection and assignment features.';