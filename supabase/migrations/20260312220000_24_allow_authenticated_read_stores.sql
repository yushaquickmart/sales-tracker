/*
  # Allow authenticated users to read stores

  The app needs employees/moderators to be able to fetch store id/name
  (e.g. to select an assigned store when creating orders).

  RLS was enabled on `stores` and only admin CRUD was added, which blocks
  SELECT for non-admins and makes assigned store lookups appear empty.
*/

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stores" ON stores;

CREATE POLICY "Authenticated users can read stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (true);

