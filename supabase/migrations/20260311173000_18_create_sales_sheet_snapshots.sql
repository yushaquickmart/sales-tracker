/*
  # Create sales_sheet_snapshots table

  Stores a full JSON snapshot of each generated sales sheet preview
  (per store, per day), including per-product rows and summary totals.
  This lets the UI render saved sheets as exact replicas of the preview.
*/

CREATE TABLE IF NOT EXISTS sales_sheet_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_sheet_id uuid NOT NULL REFERENCES sales_sheets(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date date NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_sheet_snapshots_sales_sheet_id
  ON sales_sheet_snapshots(sales_sheet_id);

CREATE INDEX IF NOT EXISTS idx_sales_sheet_snapshots_store_date
  ON sales_sheet_snapshots(store_id, date);

ALTER TABLE sales_sheet_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow moderators/admins to insert snapshots for their assigned stores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_sheet_snapshots'
      AND policyname = 'Moderators can insert snapshots for assigned stores'
  ) THEN
    EXECUTE 'DROP POLICY "Moderators can insert snapshots for assigned stores" ON sales_sheet_snapshots';
  END IF;
END $$;

CREATE POLICY "Moderators can insert snapshots for assigned stores"
  ON sales_sheet_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id = ANY(
      COALESCE(
        (SELECT store_ids FROM profiles WHERE id = auth.uid()),
        '{}'
      )
    )
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

-- Allow assigned users and admins to read snapshots
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_sheet_snapshots'
      AND policyname = 'Users can view snapshots for accessible stores'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view snapshots for accessible stores" ON sales_sheet_snapshots';
  END IF;
END $$;

CREATE POLICY "Users can view snapshots for accessible stores"
  ON sales_sheet_snapshots
  FOR SELECT
  TO authenticated
  USING (
    store_id = ANY(
      COALESCE(
        (SELECT store_ids FROM profiles WHERE id = auth.uid()),
        '{}'
      )
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

