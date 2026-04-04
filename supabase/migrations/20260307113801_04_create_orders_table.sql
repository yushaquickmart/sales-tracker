/*
  # Create Orders Table

  1. New Tables
    - `orders` - Individual product sales
      - `id` (uuid, primary key)
      - `store_id` (uuid, references stores)
      - `employee_id` (uuid, references profiles)
      - `customer_name` (text)
      - `customer_phone` (text)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `selling_price_per_unit` (numeric)
      - `total_sell_price` (numeric, calculated)
      - `order_date` (date)
      - `created_at` (timestamptz)

  2. Indexes
    - store_id for fast filtering
    - order_date for daily queries
    - employee_id for employee filtering
    - created_at for sorting

  3. Security
    - Enable RLS on `orders` table
    - Employees can view/insert only their store's orders
    - Moderators can view their store's orders
    - Admins can view all orders
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  selling_price_per_unit numeric NOT NULL CHECK (selling_price_per_unit > 0),
  total_sell_price numeric NOT NULL,
  order_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_employee_id ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, order_date);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid() 
    AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view own store orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('moderator', 'admin')
  );

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');