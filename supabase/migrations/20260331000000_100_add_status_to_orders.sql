ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'delivered', 'returned'));
ALTER TABLE public.deleted_orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'deleted' CHECK (status IN ('active', 'delivered', 'returned', 'deleted'));


DROP FUNCTION IF EXISTS public.delete_order_to_deleted(uuid);
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
    created_at, created_by, deleted_at, deleted_by, status
  )
  SELECT
    o.id, o.store_id, o.employee_id, o.customer_name, o.customer_phone, o.product_id,
    o.quantity, o.selling_price_per_unit, o.total_sell_price, o.order_date,
    o.created_at, o.created_by, now(), auth.uid(), o.status
  FROM public.orders o
  WHERE o.id = order_id
  ON CONFLICT (id) DO UPDATE
    SET deleted_at = excluded.deleted_at,
        deleted_by = excluded.deleted_by,
        status = excluded.status;

  DELETE FROM public.orders o WHERE o.id = order_id;

  RETURN QUERY
  SELECT * FROM public.deleted_orders d WHERE d.id = order_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.delete_order_to_deleted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_to_deleted(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_orders_by_date(date, boolean);
CREATE OR REPLACE FUNCTION public.admin_orders_by_date(day date, include_deleted boolean DEFAULT true)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, is_deleted boolean,
  deleted_at timestamptz, deleted_by uuid, status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, false as is_deleted,
    NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, o.status
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
    d.deleted_at, d.deleted_by, d.status
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
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
  deleted_at timestamptz, deleted_by uuid, status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, false as is_deleted,
    NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, o.status
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
    d.deleted_at, d.deleted_by, d.status
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND d.id = order_id
    AND d.deleted_at >= (now() - interval '72 hours')
  LIMIT 1;
$func$;

REVOKE ALL ON FUNCTION public.admin_order_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_by_id(uuid) TO authenticated;

