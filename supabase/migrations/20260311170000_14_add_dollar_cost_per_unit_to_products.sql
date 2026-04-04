/*
  # Add dollar_cost_per_unit to products

  Adds a default per-unit dollar cost on each product so that
  new sales sheets can pre-fill per-product dollar cost values.
*/

ALTER TABLE products
ADD COLUMN IF NOT EXISTS dollar_cost_per_unit numeric NOT NULL DEFAULT 0;

