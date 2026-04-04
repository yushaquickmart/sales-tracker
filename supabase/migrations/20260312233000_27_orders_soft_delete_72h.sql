/*
  # Soft delete orders for 72 hours

  Requirements:
  - Moderator can "delete" an order (soft delete).
  - Deleted orders are retained for 72 hours.
  - Admin can see deleted orders for 72 hours and they should appear as deleted.
  - Employees should only see their own non-deleted orders.
  - Moderators should see all non-deleted orders (across stores).
*/

-- 1) Schema changes
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);

-- 2) SELECT visibility policies (exclude deleted for non-admins)
DROP POLICY IF EXISTS "Employees can view own orders" ON orders;
DROP POLICY IF EXISTS "Moderators can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- Employee: only own, and not deleted
CREATE POLICY "Employees can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Moderator: all orders, but not deleted
CREATE POLICY "Moderators can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'moderator'
    AND deleted_at IS NULL
  );

-- Admin: can see non-deleted, plus deleted for last 72 hours
CREATE POLICY "Admins can view orders including recently deleted"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND (
      deleted_at IS NULL
      OR deleted_at >= (now() - interval '72 hours')
    )
  );

-- 3) Soft-delete permission (UPDATE)
-- Allow moderators/admins to mark orders deleted/restored by updating deleted_at/deleted_by.
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

-- 4) Optional purge helper (run manually or via scheduled job)
CREATE OR REPLACE FUNCTION public.purge_deleted_orders_older_than_72h()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.orders
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - interval '72 hours');
$$;

