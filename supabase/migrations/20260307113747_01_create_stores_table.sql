/*
  # Create Stores Table

  1. New Tables
    - `stores` - Master table for the 3 stores
      - `id` (uuid, primary key)
      - `store_name` (text, unique)
      - `created_at` (timestamptz)

  2. Data
    - Insert 3 stores: Store A, Store B, Store C
*/

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO stores (store_name) VALUES 
  ('Store A'),
  ('Store B'),
  ('Store C')
ON CONFLICT (store_name) DO NOTHING;