/*
  # Employee order visibility

  Requirement:
  - Employees should only be able to see orders created by themselves.
  - Moderators can see orders for their assigned store(s).
  - Admins already have full access via admin policies.
*/

-- ORDERS
DROP POLICY IF EXISTS "Employees can view assigned stores orders" ON orders;
DROP POLICY IF EXISTS "Employees can view own store orders" ON orders;
DROP POLICY IF EXISTS "Employees can view own orders" ON orders;
DROP POLICY IF EXISTS "Moderators can view assigned stores orders" ON orders;

-- Employees: only their own orders
CREATE POLICY "Employees can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Moderators: orders in assigned store(s)
CREATE POLICY "Moderators can view assigned stores orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
    AND store_id = ANY(
      COALESCE(
        (SELECT store_ids FROM profiles WHERE id = auth.uid()),
        CASE
          WHEN (SELECT store_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
            THEN ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
          ELSE '{}'
        END
      )
    )
  );

