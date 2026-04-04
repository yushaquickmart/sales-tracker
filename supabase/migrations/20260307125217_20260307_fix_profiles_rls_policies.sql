/*
  # Fix Profiles RLS Policies
  
  1. Issue
    - Users cannot read their own profiles due to circular RLS logic
    - The current SELECT policy checks if user is admin, but admin status is determined by the profile role column
    - This creates a catch-22 where users can't read their own profile to determine permissions
  
  2. Solution
    - Replace the SELECT policy to allow users to read their own profile (authenticated)
    - Keep admin-specific view-all policy
    - This allows login flow to work: user logs in → fetches own profile → determines role
  
  3. Changes
    - Drop restrictive SELECT policies
    - Add new policy: authenticated users can read their own profile by ID
    - Add new policy: admins can view all profiles (unchanged logic)
*/

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = id) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
