/*
  # 102 - Add returned orders

  1. Create returned_orders table.
  2. Modify Sales Sheets to include total_returned_amount.
  3. Create RPC return_order(order_id).
  4. Create RPC admin_returned_orders_by_date.
  5. Remove order status from orders, deleted_orders (if present) and fix dependent RPCs.
*/

CREATE TABLE IF NOT EXISTS public.returned_orders (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  selling_price_per_unit numeric NOT NULL CHECK (selling_price_per_unit > 0),
  total_sell_price numeric NOT NULL,
  order_date date NOT NULL,
  created_at timestamptz NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  returned_at timestamptz NOT NULL DEFAULT now(),
  returned_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_returned_orders_returned_at ON public.returned_orders(returned_at);
CREATE INDEX IF NOT EXISTS idx_returned_orders_order_date ON public.returned_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_returned_orders_store_id ON public.returned_orders(store_id);

ALTER TABLE public.returned_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and moderators can read recent returned orders"
  ON public.returned_orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'moderator')
  );

ALTER TABLE public.sales_sheets ADD COLUMN IF NOT EXISTS total_returned_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.return_order_to_returned(order_id uuid)
RETURNS SETOF public.returned_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.returned_orders (
    id, store_id, employee_id, customer_name, customer_phone, product_id,
    quantity, selling_price_per_unit, total_sell_price, order_date,
    created_at, created_by, returned_at, returned_by
  )
  SELECT
    o.id, o.store_id, o.employee_id, o.customer_name, o.customer_phone, o.product_id,
    o.quantity, o.selling_price_per_unit, o.total_sell_price, o.order_date,
    o.created_at, o.created_by, now(), auth.uid()
  FROM public.orders o
  WHERE o.id = order_id
  ON CONFLICT (id) DO UPDATE
    SET returned_at = excluded.returned_at,
        returned_by = excluded.returned_by;

  DELETE FROM public.orders o WHERE o.id = order_id;

  RETURN QUERY
  SELECT * FROM public.returned_orders d WHERE d.id = order_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.return_order_to_returned(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_order_to_returned(uuid) TO authenticated;

-- Rewrite delete_order_to_deleted to remove status
CREATE OR REPLACE FUNCTION public.delete_order_to_deleted(order_id uuid)
RETURNS SETOF public.deleted_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.deleted_orders (
    id, store_id, employee_id, customer_name, customer_phone, product_id,
    quantity, selling_price_per_unit, total_sell_price, order_date,
    created_at, created_by, deleted_at, deleted_by
  )
  SELECT
    o.id, o.store_id, o.employee_id, o.customer_name, o.customer_phone, o.product_id,
    o.quantity, o.selling_price_per_unit, o.total_sell_price, o.order_date,
    o.created_at, o.created_by, now(), auth.uid()
  FROM public.orders o
  WHERE o.id = order_id
  ON CONFLICT (id) DO UPDATE
    SET deleted_at = excluded.deleted_at,
        deleted_by = excluded.deleted_by;

  DELETE FROM public.orders o WHERE o.id = order_id;

  RETURN QUERY
  SELECT * FROM public.deleted_orders d WHERE d.id = order_id;
END;
$func$;

-- Modify admin views to remove status
DROP FUNCTION IF EXISTS public.admin_orders_by_date(date, boolean);
CREATE OR REPLACE FUNCTION public.admin_orders_by_date(day date, include_deleted boolean DEFAULT true)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, is_deleted boolean,
  deleted_at timestamptz, deleted_by uuid, deleted_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, false as is_deleted,
    NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, NULL::text as deleted_by_name
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  JOIN public.products p ON p.id = o.product_id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND o.order_date = day

  UNION ALL

  SELECT
    d.id, d.store_id, s.store_name, d.employee_id, d.customer_name, d.customer_phone,
    d.product_id, p.product_name, p.buying_price, d.quantity, d.selling_price_per_unit,
    d.total_sell_price, d.order_date, d.created_at, d.created_by, true as is_deleted,
    d.deleted_at, d.deleted_by, dp.name as deleted_by_name
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND include_deleted = true
    AND d.order_date = day
    AND d.deleted_at >= (now() - interval '72 hours')
  ORDER BY created_at DESC;
$func$;

REVOKE ALL ON FUNCTION public.admin_orders_by_date(date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_orders_by_date(date, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_order_by_id(uuid);
CREATE OR REPLACE FUNCTION public.admin_order_by_id(order_id uuid)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, is_deleted boolean,
  deleted_at timestamptz, deleted_by uuid, deleted_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, false as is_deleted,
    NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, NULL::text as deleted_by_name
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  JOIN public.products p ON p.id = o.product_id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND o.id = order_id

  UNION ALL

  SELECT
    d.id, d.store_id, s.store_name, d.employee_id, d.customer_name, d.customer_phone,
    d.product_id, p.product_name, p.buying_price, d.quantity, d.selling_price_per_unit,
    d.total_sell_price, d.order_date, d.created_at, d.created_by, true as is_deleted,
    d.deleted_at, d.deleted_by, dp.name as deleted_by_name
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND d.id = order_id
    AND d.deleted_at >= (now() - interval '72 hours')
  LIMIT 1;
$func$;

REVOKE ALL ON FUNCTION public.admin_order_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_by_id(uuid) TO authenticated;

-- Function to get returned orders for a specific day
CREATE OR REPLACE FUNCTION public.moderator_returned_orders_by_date(day date)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, returned_at timestamptz,
  returned_by uuid, returned_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    r.id, r.store_id, s.store_name, r.employee_id, r.customer_name, r.customer_phone,
    r.product_id, p.product_name, p.buying_price, r.quantity, r.selling_price_per_unit,
    r.total_sell_price, r.order_date, r.created_at, r.created_by, r.returned_at,
    r.returned_by, dp.name as returned_by_name
  FROM public.returned_orders r
  JOIN public.stores s ON s.id = r.store_id
  JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles dp ON dp.id = r.returned_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator')
    AND r.order_date = day
  ORDER BY r.returned_at DESC;
$func$;

REVOKE ALL ON FUNCTION public.moderator_returned_orders_by_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderator_returned_orders_by_date(date) TO authenticated;

ALTER TABLE public.orders DROP COLUMN IF EXISTS status;
ALTER TABLE public.deleted_orders DROP COLUMN IF EXISTS status;
