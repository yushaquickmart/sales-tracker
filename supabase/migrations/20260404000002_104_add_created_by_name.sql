/*
  # 104 - Add created_by_name to admin/moderator queries

  1. Update admin_orders_by_date to return created_by_name
  2. Update moderator_returned_orders_by_date to return created_by_name
  3. Update admin_order_by_id to return created_by_name
*/

-- Modify admin_orders_by_date
DROP FUNCTION IF EXISTS public.admin_orders_by_date(date, boolean);
CREATE OR REPLACE FUNCTION public.admin_orders_by_date(day date, include_deleted boolean DEFAULT true)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, created_by_name text,
  is_deleted boolean, deleted_at timestamptz, deleted_by uuid, deleted_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, cp.name as created_by_name,
    false as is_deleted,
    NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, NULL::text as deleted_by_name
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.profiles cp ON cp.id = o.created_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND o.order_date = day

  UNION ALL

  SELECT
    d.id, d.store_id, s.store_name, d.employee_id, d.customer_name, d.customer_phone,
    d.product_id, p.product_name, p.buying_price, d.quantity, d.selling_price_per_unit,
    d.total_sell_price, d.order_date, d.created_at, d.created_by, cp.name as created_by_name,
    true as is_deleted,
    d.deleted_at, d.deleted_by, dp.name as deleted_by_name
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  LEFT JOIN public.profiles cp ON cp.id = d.created_by
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND include_deleted = true
    AND d.order_date = day
    AND d.deleted_at >= (now() - interval '72 hours')
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_orders_by_date(date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_orders_by_date(date, boolean) TO authenticated;

-- Modify admin_order_by_id
DROP FUNCTION IF EXISTS public.admin_order_by_id(uuid);
CREATE OR REPLACE FUNCTION public.admin_order_by_id(order_id uuid)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, created_by_name text,
  is_deleted boolean, deleted_at timestamptz, deleted_by uuid, deleted_by_name text,
  is_returned boolean, returned_at timestamptz, returned_by uuid, returned_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.store_id, s.store_name, o.employee_id, o.customer_name, o.customer_phone,
    o.product_id, p.product_name, p.buying_price, o.quantity, o.selling_price_per_unit,
    o.total_sell_price, o.order_date, o.created_at, o.created_by, cp.name as created_by_name,
    false as is_deleted, NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, NULL::text as deleted_by_name,
    false as is_returned, NULL::timestamptz as returned_at, NULL::uuid as returned_by, NULL::text as returned_by_name
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.profiles cp ON cp.id = o.created_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND o.id = order_id

  UNION ALL

  SELECT
    d.id, d.store_id, s.store_name, d.employee_id, d.customer_name, d.customer_phone,
    d.product_id, p.product_name, p.buying_price, d.quantity, d.selling_price_per_unit,
    d.total_sell_price, d.order_date, d.created_at, d.created_by, cp.name as created_by_name,
    true as is_deleted, d.deleted_at, d.deleted_by, dp.name as deleted_by_name,
    false as is_returned, NULL::timestamptz as returned_at, NULL::uuid as returned_by, NULL::text as returned_by_name
  FROM public.deleted_orders d
  JOIN public.stores s ON s.id = d.store_id
  JOIN public.products p ON p.id = d.product_id
  LEFT JOIN public.profiles cp ON cp.id = d.created_by
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND d.id = order_id

  UNION ALL

  SELECT
    r.id, r.store_id, s.store_name, r.employee_id, r.customer_name, r.customer_phone,
    r.product_id, p.product_name, p.buying_price, r.quantity, r.selling_price_per_unit,
    r.total_sell_price, r.order_date, r.created_at, r.created_by, cp.name as created_by_name,
    false as is_deleted, NULL::timestamptz as deleted_at, NULL::uuid as deleted_by, NULL::text as deleted_by_name,
    true as is_returned, r.returned_at, r.returned_by, rp.name as returned_by_name
  FROM public.returned_orders r
  JOIN public.stores s ON s.id = r.store_id
  JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles cp ON cp.id = r.created_by
  LEFT JOIN public.profiles rp ON rp.id = r.returned_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND r.id = order_id

  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.admin_order_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_by_id(uuid) TO authenticated;

-- Modify moderator_returned_orders_by_date
DROP FUNCTION IF EXISTS public.moderator_returned_orders_by_date(date);
CREATE OR REPLACE FUNCTION public.moderator_returned_orders_by_date(day date)
RETURNS TABLE (
  id uuid, store_id uuid, store_name text, employee_id uuid, customer_name text,
  customer_phone text, product_id uuid, product_name text, buying_price numeric,
  quantity integer, selling_price_per_unit numeric, total_sell_price numeric,
  order_date date, created_at timestamptz, created_by uuid, created_by_name text,
  returned_at timestamptz, returned_by uuid, returned_by_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.store_id, s.store_name, r.employee_id, r.customer_name, r.customer_phone,
    r.product_id, p.product_name, p.buying_price, r.quantity, r.selling_price_per_unit,
    r.total_sell_price, r.order_date, r.created_at, r.created_by, cp.name as created_by_name,
    r.returned_at, r.returned_by, dp.name as returned_by_name
  FROM public.returned_orders r
  JOIN public.stores s ON s.id = r.store_id
  JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles cp ON cp.id = r.created_by
  LEFT JOIN public.profiles dp ON dp.id = r.returned_by
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator')
    AND r.order_date = day
  ORDER BY r.returned_at DESC;
$$;

REVOKE ALL ON FUNCTION public.moderator_returned_orders_by_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderator_returned_orders_by_date(date) TO authenticated;
