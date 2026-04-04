/*
  Fix profile_stores policies - PostgreSQL does not support CREATE POLICY IF NOT EXISTS.
  Use DROP IF EXISTS + CREATE for idempotent policy setup.
*/

-- Ensure profile_stores table exists (in case migration 08 failed)
CREATE TABLE IF NOT EXISTS profile_stores (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id   uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, store_id)
);

ALTER TABLE profile_stores ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (idempotent)
DROP POLICY IF EXISTS "User can see own profile stores" ON profile_stores;
CREATE POLICY "User can see own profile stores"
  ON profile_stores
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage profile stores" ON profile_stores;
CREATE POLICY "Admins can manage profile stores"
  ON profile_stores
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
