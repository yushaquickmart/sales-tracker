/*
  # Fix Profiles RLS Policies (No Circular References)

  1. Issue
    - Existing profiles RLS policies for admins use:
        (SELECT role FROM profiles WHERE id = auth.uid())
      on the same table (`profiles`), which can cause recursive RLS
      evaluation and 500 errors when selecting profiles.

  2. Solution
    - Drop all profiles policies that reference `SELECT role FROM profiles`
      on the same table.
    - Keep a minimal, safe policy set:
        - Authenticated users can read their own profile.
        - Authenticated users can update their own profile.
      (Admin-only insert / update / delete operations should be performed
       via the service role key or direct SQL, not via client RLS.)

  3. Result
    - Login flow that reads the current user's profile by ID will work
      without triggering circular RLS logic.
*/

-- 1. Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- 2. Drop admin CRUD policies that reference profiles again
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- 3. Recreate safe, non-recursive policies

-- Authenticated users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

