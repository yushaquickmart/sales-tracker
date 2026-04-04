/*
  # Seed Initial Data
  
  1. New Data
    - Create a default store for testing
    - This data is foundational for the application to work
  
  2. Notes
    - Store is required before creating users
    - Admin user will be created separately via auth
*/

INSERT INTO stores (store_name) 
VALUES ('Main Store')
ON CONFLICT DO NOTHING;
