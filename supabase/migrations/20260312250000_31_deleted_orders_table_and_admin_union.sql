/*
  # Deleted orders retention (72 hours) using separate table

  Behavior:
  - Moderator/Admin deletes an order -> move row from `orders` to `deleted_orders`
  - Admin can view deleted orders for 72 hours (marked as deleted)
  - Deleted orders are purged after 72 hours
  - Admin UI should show active + deleted in one list
*/

-- 1) Deleted orders table (same key as original order id)
CREATE TABLE IF NOT EXISTS public.deleted_orders (
  id uuid PRIMARY KEY, -- original orders.id
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
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_at ON public.deleted_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_orders_order_date ON public.deleted_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_deleted_orders_store_id ON public.deleted_orders(store_id);

ALTER TABLE public.deleted_orders ENABLE ROW LEVEL SECURITY;

-- Admin can read deleted orders for last 72 hours
DROP POLICY IF EXISTS "Admins can read recent deleted orders" ON public.deleted_orders;
CREATE POLICY "Admins can read recent deleted orders"
  ON public.deleted_orders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND deleted_at >= (now() - interval '72 hours')
  );

-- 2) RPC: delete -> move to deleted_orders and remove from orders
CREATE OR REPLACE FUNCTION public.delete_order_to_deleted(order_id uuid)
RETURNS SETOF public.deleted_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Insert snapshot into deleted table
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

  -- Delete from main table
  DELETE FROM public.orders o WHERE o.id = order_id;

  RETURN QUERY
  SELECT * FROM public.deleted_orders d WHERE d.id = order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_to_deleted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_to_deleted(uuid) TO authenticated;

-- 3) RPC: admin list orders by date (active + deleted-within-72h), with deleted flag
CREATE OR REPLACE FUNCTION public.admin_orders_by_date(day date, include_deleted boolean DEFAULT true)
RETURNS TABLE (
  id uuid,
  store_id uuid,
  store_name text,
  employee_id uuid,
  customer_name text,
  customer_phone text,
  product_id uuid,
  product_name text,
  buying_price numeric,
  quantity integer,
  selling_price_per_unit numeric,
  total_sell_price numeric,
  order_date date,
  created_at timestamptz,
  created_by uuid,
  is_deleted boolean,
  deleted_at timestamptz,
  deleted_by uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.store_id,
    s.store_name,
    o.employee_id,
    o.customer_name,
    o.customer_phone,
    o.product_id,
    p.product_name,
    p.buying_price,
    o.quantity,
    o.selling_price_per_unit,
    o.total_sell_price,
    o.order_date,
    o.created_at,
    o.created_by,
    false as is_deleted,
    NULL::timestamptz as deleted_at,
    NULL::uuid as deleted_by
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  JOIN public.products p ON p.id = o.product_id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND o.order_date = day

  UNION ALL

  SELECT
    d.id,
    d.store_id,
    s.store_name,
    d.employee_id,
    d.customer_name,
    d.customer_phone,
    d.product_id,
    p.product_name,
    p.buying_price,
    d.quantity,
    d.selling_price_per_unit,
    d.total_sell_price,
    d.order_date,
    d.created_at,
    d.created_by,
    true as is_deleted,
    d.deleted_at,
    d.deleted_by
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND include_deleted = true
    AND d.order_date = day
    AND d.deleted_at >= (now() - interval '72 hours')
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_orders_by_date(date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_orders_by_date(date, boolean) TO authenticated;

-- 4) Purge helper (schedule this daily/hourly in Supabase)
CREATE OR REPLACE FUNCTION public.purge_deleted_orders()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.deleted_orders
  WHERE deleted_at < (now() - interval '72 hours');
$$;

