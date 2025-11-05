-- Update profiles table RLS policy to allow viewing all users
-- This is needed so users can assign tasks to other team members

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new policy allowing users to view all profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Keep the existing policies for insert and update (users can only modify their own profile)
-- These policies remain unchanged and secure