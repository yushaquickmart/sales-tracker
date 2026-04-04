/*
  # Fix orders store-assignment check for employees

  Problem:
  - Some environments still have older `orders` RLS policies that check
    `profiles.store_id` (single store) instead of `profiles.store_ids` (uuid[]).
  - This makes employees/moderators appear "assigned" in the UI, but inserts fail
    with RLS when `profiles.store_id` is NULL.

  Fix:
  - Recreate the key employee SELECT/INSERT policies to allow access when the
    order's store_id is in `profiles.store_ids`.
  - Fallback to legacy `profiles.store_id` if store_ids is empty (safe for old data).
*/

-- ORDERS
DROP POLICY IF EXISTS "Employees can insert own orders" ON orders;
DROP POLICY IF EXISTS "Employees can view own store orders" ON orders;
DROP POLICY IF EXISTS "Employees can view assigned stores orders" ON orders;

-- Employees can insert orders only for their assigned store(s)
CREATE POLICY "Employees can insert own orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND (
      store_id = ANY(
        COALESCE(
          (SELECT store_ids FROM profiles WHERE id = auth.uid()),
          CASE
            WHEN (SELECT store_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
              THEN ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
            ELSE '{}'
          END
        )
      )
    )
  );

-- Employees can view orders for their assigned store(s); moderators/admins can view too
CREATE POLICY "Employees can view assigned stores orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    store_id = ANY(
      COALESCE(
        (SELECT store_ids FROM profiles WHERE id = auth.uid()),
        CASE
          WHEN (SELECT store_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
            THEN ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
          ELSE '{}'
        END
      )
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

