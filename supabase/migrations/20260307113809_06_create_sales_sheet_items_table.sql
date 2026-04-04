/*
  # Create Sales Sheet Items Table

  1. New Tables
    - `sales_sheet_items` - Per-product breakdown for each sales sheet
      - `id` (uuid, primary key)
      - `sales_sheet_id` (uuid, references sales_sheets)
      - `product_id` (uuid, references products)
      - `quantity_sold` (integer)
      - `total_sell_value` (numeric, auto-calculated)
      - `total_buy_cost` (numeric, auto-calculated)
      - `profit` (numeric, auto-calculated)

  2. Indexes
    - sales_sheet_id for fast lookups

  3. Security
    - Enable RLS on `sales_sheet_items` table
    - Same as sales_sheets policies
*/

CREATE TABLE IF NOT EXISTS sales_sheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_sheet_id uuid NOT NULL REFERENCES sales_sheets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_sold integer NOT NULL CHECK (quantity_sold > 0),
  total_sell_value numeric NOT NULL DEFAULT 0,
  total_buy_cost numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sales_sheet_items_sales_sheet_id ON sales_sheet_items(sales_sheet_id);
CREATE INDEX IF NOT EXISTS idx_sales_sheet_items_product_id ON sales_sheet_items(product_id);

ALTER TABLE sales_sheet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items for accessible sales sheets"
  ON sales_sheet_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_sheets
      WHERE sales_sheets.id = sales_sheet_items.sales_sheet_id
      AND (
        sales_sheets.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      )
    )
  );

CREATE POLICY "Moderators can insert items for their store sheets"
  ON sales_sheet_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_sheets
      WHERE sales_sheets.id = sales_sheet_items.sales_sheet_id
      AND sales_sheets.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
    )
  );