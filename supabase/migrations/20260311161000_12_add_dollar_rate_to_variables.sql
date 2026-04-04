/*
  # Add dollar_rate to variables

  Stores the exchange rate (Tk per $) for per-product dollar cost calculations.
*/

ALTER TABLE variables
ADD COLUMN IF NOT EXISTS dollar_rate numeric NOT NULL DEFAULT 1;

