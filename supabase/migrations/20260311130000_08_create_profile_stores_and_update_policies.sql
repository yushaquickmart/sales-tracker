/*
  # Enable Multiple Stores Per User

  1. New Tables
    - `profile_stores` - junction table mapping profiles to multiple stores

  2. Data Migration
    - Copy existing profiles.store_id values into profile_stores

  3. RLS Updates
    - Update store-based policies on orders, sales_sheets, sales_sheet_items, expenses
      to use profile_stores instead of a single profiles.store_id
*/

-- 1. Junction table for many-to-many profile ↔ store
CREATE TABLE IF NOT EXISTS profile_stores (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id   uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, store_id)
);

ALTER TABLE profile_stores ENABLE ROW LEVEL SECURITY;

-- Allow each user to see their own store mappings
CREATE POLICY IF NOT EXISTS "User can see own profile stores"
  ON profile_stores
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Allow admins to manage all mappings
CREATE POLICY IF NOT EXISTS "Admins can manage profile stores"
  ON profile_stores
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 2. One-time data migration: copy existing primary store_id into profile_stores
INSERT INTO profile_stores (profile_id, store_id)
SELECT id AS profile_id, store_id
FROM profiles
WHERE store_id IS NOT NULL
ON CONFLICT (profile_id, store_id) DO NOTHING;

-- 3. Update store-based RLS policies to use profile_stores

-- ORDERS
DROP POLICY IF EXISTS "Employees can insert own orders" ON orders;
DROP POLICY IF EXISTS "Employees can view own store orders" ON orders;

CREATE POLICY "Employees can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view assigned stores orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- SALES SHEETS
DROP POLICY IF EXISTS "Moderators can create sales sheets for their store" ON sales_sheets;
DROP POLICY IF EXISTS "Moderators can view their store sales sheets" ON sales_sheets;
DROP POLICY IF EXISTS "Moderators can update their store sales sheets" ON sales_sheets;

CREATE POLICY "Moderators can create sales sheets for assigned stores"
  ON sales_sheets FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Moderators can view assigned stores sales sheets"
  ON sales_sheets FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Moderators can update assigned stores sales sheets"
  ON sales_sheets FOR UPDATE
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- EXPENSES
DROP POLICY IF EXISTS "Moderators can view their store expenses" ON expenses;
DROP POLICY IF EXISTS "Moderators can insert expenses for their store" ON expenses;
DROP POLICY IF EXISTS "Moderators can update their store expenses" ON expenses;

CREATE POLICY "Moderators can view assigned stores expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Moderators can insert expenses for assigned stores"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Moderators can update assigned stores expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    store_id IN (
      SELECT store_id
      FROM profile_stores
      WHERE profile_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- SALES SHEET ITEMS
DROP POLICY IF EXISTS "Users can view items for accessible sales sheets" ON sales_sheet_items;
DROP POLICY IF EXISTS "Moderators can insert items for their store sheets" ON sales_sheet_items;

CREATE POLICY "Users can view items for accessible sales sheets"
  ON sales_sheet_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sales_sheets
      WHERE sales_sheets.id = sales_sheet_items.sales_sheet_id
        AND (
          sales_sheets.store_id IN (
            SELECT store_id
            FROM profile_stores
            WHERE profile_id = auth.uid()
          )
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
        AND sales_sheets.store_id IN (
          SELECT store_id
          FROM profile_stores
          WHERE profile_id = auth.uid()
        )
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
    )
  );

