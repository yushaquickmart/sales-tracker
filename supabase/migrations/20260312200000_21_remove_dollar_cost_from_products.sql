/*
  # Remove dollar cost from products

  Dollar cost is no longer stored per product; it is set per product
  on each sales sheet (sales_sheet_items.per_product_dollar, dollar_cost_tk).
*/

ALTER TABLE products
DROP COLUMN IF EXISTS dollar_cost_per_unit;
