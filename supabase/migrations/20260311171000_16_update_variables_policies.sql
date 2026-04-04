/*
  # Update variables table policies

  Allow authenticated users (e.g. moderators/employees) to READ the global
  variables while keeping write access restricted to admins only.
*/

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE variables ENABLE ROW LEVEL SECURITY;

-- Recreate read policy in an idempotent way compatible with older Postgres
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'variables'
      AND policyname = 'Authenticated can read variables'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated can read variables" ON variables';
  END IF;
END $$;

CREATE POLICY "Authenticated can read variables"
  ON variables
  FOR SELECT
  TO authenticated
  USING (true);

