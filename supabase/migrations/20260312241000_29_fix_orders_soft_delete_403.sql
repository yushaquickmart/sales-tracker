/*
  # Fix 403 when moderator soft-deletes an order

  A 403 from PostgREST on UPDATE can happen if:
  - the `authenticated` role lacks UPDATE privilege on `orders`, and/or
  - the relevant RLS UPDATE policy isn't present/applied.

  This migration:
  - Ensures soft-delete columns exist
  - Grants required table privileges to `authenticated`
  - Recreates a clear UPDATE policy allowing moderators/admins to soft-delete
*/

-- Ensure columns exist (idempotent)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Ensure RLS is enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated has needed privileges (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;

-- Recreate soft-delete UPDATE policy
DROP POLICY IF EXISTS "Moderators and admins can soft delete orders" ON orders;
DROP POLICY IF EXISTS "Moderators can soft delete orders" ON orders;
DROP POLICY IF EXISTS "Admins can soft delete orders" ON orders;

CREATE POLICY "Moderators and admins can soft delete orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

