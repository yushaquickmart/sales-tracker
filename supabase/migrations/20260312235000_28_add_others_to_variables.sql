/*
  # Add `others` to variables

  Adds a new numeric field `others` to the single-row `variables` table.
  This is part of fixed expenses and should be included in calculations.
*/

ALTER TABLE variables
ADD COLUMN IF NOT EXISTS others numeric NOT NULL DEFAULT 0;

