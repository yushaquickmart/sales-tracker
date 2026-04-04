/*
  Store multiple store IDs as PostgreSQL array in profiles.store_ids
  Replaces profile_stores junction table for simpler multi-store support.
*/

-- 1. Add store_ids uuid[] column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS store_ids uuid[] DEFAULT '{}';

-- 2. Migrate data: from profile_stores (if exists) or from store_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_stores') THEN
    UPDATE profiles p
    SET store_ids = COALESCE(
      (SELECT array_agg(DISTINCT ps.store_id) FROM profile_stores ps WHERE ps.profile_id = p.id),
      CASE WHEN p.store_id IS NOT NULL THEN ARRAY[p.store_id] ELSE '{}' END
    );
  ELSE
    UPDATE profiles
    SET store_ids = CASE WHEN store_id IS NOT NULL THEN ARRAY[store_id] ELSE '{}' END
    WHERE store_ids = '{}' OR store_ids IS NULL;
  END IF;
END $$;

-- 3. Update RLS policies to use store_ids array instead of profile_stores

-- ORDERS
DROP POLICY IF EXISTS "Employees can insert own orders" ON orders;
DROP POLICY IF EXISTS "Employees can view assigned stores orders" ON orders;

CREATE POLICY "Employees can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
  );

CREATE POLICY "Employees can view assigned stores orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- SALES SHEETS
DROP POLICY IF EXISTS "Moderators can create sales sheets for assigned stores" ON sales_sheets;
DROP POLICY IF EXISTS "Moderators can view assigned stores sales sheets" ON sales_sheets;
DROP POLICY IF EXISTS "Moderators can update assigned stores sales sheets" ON sales_sheets;

CREATE POLICY "Moderators can create sales sheets for assigned stores"
  ON sales_sheets FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Moderators can view assigned stores sales sheets"
  ON sales_sheets FOR SELECT
  TO authenticated
  USING (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Moderators can update assigned stores sales sheets"
  ON sales_sheets FOR UPDATE
  TO authenticated
  USING (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- EXPENSES
DROP POLICY IF EXISTS "Moderators can view assigned stores expenses" ON expenses;
DROP POLICY IF EXISTS "Moderators can insert expenses for assigned stores" ON expenses;
DROP POLICY IF EXISTS "Moderators can update expenses for assigned stores" ON expenses;

CREATE POLICY "Moderators can view assigned stores expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Moderators can insert expenses for assigned stores"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Moderators can update expenses for assigned stores"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- SALES SHEET ITEMS
DROP POLICY IF EXISTS "Users can view items for accessible sales sheets" ON sales_sheet_items;
DROP POLICY IF EXISTS "Moderators can insert items for assigned store sheets" ON sales_sheet_items;

CREATE POLICY "Users can view items for accessible sales sheets"
  ON sales_sheet_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sales_sheets
      WHERE sales_sheets.id = sales_sheet_items.sales_sheet_id
        AND (
          sales_sheets.store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
          OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
        )
    )
  );

CREATE POLICY "Moderators can insert items for assigned store sheets"
  ON sales_sheet_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sales_sheets
      WHERE sales_sheets.id = sales_sheet_items.sales_sheet_id
        AND sales_sheets.store_id = ANY(COALESCE((SELECT store_ids FROM profiles WHERE id = auth.uid()), '{}'))
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
    )
  );
