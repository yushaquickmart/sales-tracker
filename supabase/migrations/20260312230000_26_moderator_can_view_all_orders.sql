/*
  # Moderator can view all orders

  Requirements:
  - employee: can only see orders created by themselves (already enforced by policy)
  - moderator: can see all orders from all shops
  - admin: can see all orders (already via admin CRUD policy)
*/

-- Remove store-scoped moderator policy (if present)
DROP POLICY IF EXISTS "Moderators can view assigned stores orders" ON orders;

-- Allow moderators (and admins) to view all orders
DROP POLICY IF EXISTS "Moderators can view all orders" ON orders;
CREATE POLICY "Moderators can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin'));

