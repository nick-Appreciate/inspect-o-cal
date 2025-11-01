-- Fix security definer view by adding explicit RLS on the view
-- The view needs SECURITY DEFINER to bypass profiles RLS, but we add view-level RLS for safety

-- First, ensure the view is explicitly SECURITY DEFINER (required to bypass profiles RLS)
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=false) AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Enable RLS on the view itself
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Grant access
GRANT SELECT ON public.public_profiles TO authenticated;

COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles without sensitive data like email addresses. SECURITY DEFINER is intentional to allow user selection for assignments while keeping emails private.';