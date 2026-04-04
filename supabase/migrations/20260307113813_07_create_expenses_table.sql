/*
  # Create Expenses Table

  1. New Tables
    - `expenses` - Daily expenses by store
      - `id` (uuid, primary key)
      - `date` (date)
      - `operational_expense` (numeric)
      - `management_cost` (numeric)
      - `financial_cost` (numeric)
      - `content_cost` (numeric)
      - `store_id` (uuid, nullable, references stores)
      - `created_at` (timestamptz)

  2. Indexes
    - store_id, date for daily queries

  3. Security
    - Enable RLS on `expenses` table
    - Moderators can view/insert for their store
    - Admins can view/insert all
*/

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  operational_expense numeric NOT NULL DEFAULT 0,
  management_cost numeric NOT NULL DEFAULT 0,
  financial_cost numeric NOT NULL DEFAULT 0,
  content_cost numeric NOT NULL DEFAULT 0,
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can view their store expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Moderators can insert expenses for their store"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Moderators can update their store expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  )
  WITH CHECK (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Admins can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');