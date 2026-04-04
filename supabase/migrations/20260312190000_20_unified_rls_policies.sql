/*
  # Unified RLS Policies

  Goals:
  - Ensure admins (profiles.role = 'admin') have full CRUD on all business tables.
  - Allow each authenticated user to create/read/update their own profile row.
  - Keep existing moderator/employee scoping logic where already defined.
  - Avoid circular / brittle RLS on the profiles table.
*/

----------------------------
-- PROFILES: SELF-SERVICE --
----------------------------

-- Clean up old profiles policies that may conflict
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Authenticated users can INSERT their own profile row
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Authenticated users can READ their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated users can UPDATE their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (based on their own profile row)
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

--------------------------------
-- HELPERS: ADMIN CHECK (RLS) --
--------------------------------

-- NOTE: We reuse the same admin condition across tables:
--   EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = auth.uid()
--       AND p.role = 'admin'
--   )

--------------------------
-- STORES: ADMIN CRUD   --
--------------------------

-- Ensure RLS is enabled on stores (idempotent)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all stores" ON stores;

CREATE POLICY "Admins can manage all stores"
  ON stores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

---------------------------
-- PRODUCTS: ADMIN CRUD  --
---------------------------

DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Admins can manage all products" ON products;

CREATE POLICY "Admins can manage all products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-------------------------
-- ORDERS: ADMIN CRUD  --
-------------------------

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

CREATE POLICY "Admins can manage all orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-------------------------------
-- SALES SHEETS: ADMIN CRUD  --
-------------------------------

DROP POLICY IF EXISTS "Admins can view all sales sheets" ON sales_sheets;
DROP POLICY IF EXISTS "Admins can manage all sales sheets" ON sales_sheets;

CREATE POLICY "Admins can manage all sales sheets"
  ON sales_sheets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

------------------------------------
-- SALES SHEET ITEMS: ADMIN CRUD  --
------------------------------------

DROP POLICY IF EXISTS "Admins can manage all sales_sheet_items" ON sales_sheet_items;

CREATE POLICY "Admins can manage all sales_sheet_items"
  ON sales_sheet_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

----------------------------
-- EXPENSES: ADMIN CRUD   --
----------------------------

DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Admins can manage all expenses" ON expenses;

CREATE POLICY "Admins can manage all expenses"
  ON expenses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

----------------------------------
-- VARIABLES: ALREADY ADMIN-ONLY --
----------------------------------

-- Replace previous variables policy with unified admin check
DROP POLICY IF EXISTS "Admins can manage variables" ON variables;

CREATE POLICY "Admins can manage variables"
  ON variables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-----------------------------------------
-- SALES SHEET SNAPSHOTS: ADMIN CRUD   --
-----------------------------------------

DROP POLICY IF EXISTS "Admins can manage all sales_sheet_snapshots" ON sales_sheet_snapshots;

CREATE POLICY "Admins can manage all sales_sheet_snapshots"
  ON sales_sheet_snapshots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

------------------------------
-- PROFILE_STORES: ADMIN    --
------------------------------

DROP POLICY IF EXISTS "Admins can manage all profile_stores" ON profile_stores;

CREATE POLICY "Admins can manage all profile_stores"
  ON profile_stores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

