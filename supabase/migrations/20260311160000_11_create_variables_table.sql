/*
  # Global Variables for Daily Sheets

  1. New Tables
    - `variables` - Single-row table storing global expense variables
      - `id` (uuid, primary key)
      - `operational_expense` (numeric)
      - `management_cost` (numeric)
      - `financial_cost` (numeric)
      - `content_cost` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `variables`
    - Only admins can read/update
*/

CREATE TABLE IF NOT EXISTS variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_expense numeric NOT NULL DEFAULT 0,
  management_cost     numeric NOT NULL DEFAULT 0,
  financial_cost      numeric NOT NULL DEFAULT 0,
  content_cost        numeric NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Ensure at least one row exists
INSERT INTO variables (operational_expense, management_cost, financial_cost, content_cost)
VALUES (0, 0, 0, 0)
ON CONFLICT DO NOTHING;

ALTER TABLE variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage variables"
  ON variables
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

