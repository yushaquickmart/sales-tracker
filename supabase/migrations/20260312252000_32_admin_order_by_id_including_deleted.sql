/*
  # Admin can view order details even if deleted

  Provides an RPC that returns a single order by id, searching both:
  - public.orders (active)
  - public.deleted_orders (deleted within 72 hours)

  Includes store/product details and an `is_deleted` flag.
*/

CREATE OR REPLACE FUNCTION public.admin_order_by_id(order_id uuid)
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
    AND o.id = order_id

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
    AND d.id = order_id
    AND d.deleted_at >= (now() - interval '72 hours')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.admin_order_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_by_id(uuid) TO authenticated;

