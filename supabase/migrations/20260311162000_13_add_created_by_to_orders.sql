/*
  # Track creator of each order

  Adds created_by to orders so we can filter orders by who created them.
*/

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- Backfill existing rows to use employee_id as created_by
UPDATE orders
SET created_by = employee_id
WHERE created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

