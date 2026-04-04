/*
  # Add dollar cost fields to sales_sheet_items

  Adds per-row dollar cost information so that saved sales sheets
  can persist the moderator-edited per-product dollar cost values.
*/

ALTER TABLE sales_sheet_items
ADD COLUMN IF NOT EXISTS dollar_cost_tk numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS per_product_dollar numeric NOT NULL DEFAULT 0;

