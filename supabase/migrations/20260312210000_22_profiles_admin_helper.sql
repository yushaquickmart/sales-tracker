/*
  # Fix admin seeing all profiles on refresh

  The "Admins can read all profiles" policy uses a subquery on profiles
  that is subject to RLS, which can cause only the current user's row
  to be visible in some cases. Use a SECURITY DEFINER function so the
  admin check reads profiles with owner rights and reliably returns
  whether the current user is an admin.
*/

-- Function runs with definer rights so it can read profiles without RLS blocking
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Drop and recreate the policy to use the helper
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());
