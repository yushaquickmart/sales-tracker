/*
  # Add delete policy for sales_sheets

  Allows moderators/admins to delete sales sheets for their assigned stores.
  This makes the /moderator/sales-sheets UI "Delete" action work with RLS.
*/

ALTER TABLE sales_sheets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_sheets'
      AND policyname = 'Moderators can delete assigned stores sales sheets'
  ) THEN
    EXECUTE 'DROP POLICY "Moderators can delete assigned stores sales sheets" ON sales_sheets';
  END IF;
END $$;

CREATE POLICY "Moderators can delete assigned stores sales sheets"
  ON sales_sheets
  FOR DELETE
  TO authenticated
  USING (
    store_id = ANY(
      COALESCE(
        (SELECT store_ids FROM profiles WHERE id = auth.uid()),
        '{}'
      )
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

