/*
  # 105 - Add employee incentives

  1. Create product_incentives table.
  2. Create RPC get_employee_incentives to calculate monthly incentives dynamically.
*/

CREATE TABLE IF NOT EXISTS public.product_incentives (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  threshold_price numeric NOT NULL DEFAULT 0,
  above_incentive numeric NOT NULL DEFAULT 0,
  below_incentive numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_incentives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can full access product_incentives"
  ON public.product_incentives
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can read product_incentives"
  ON public.product_incentives
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to get employee cumulative incentives by month (YYYY-MM)
CREATE OR REPLACE FUNCTION public.get_employee_incentives(target_month text)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  total_incentive numeric,
  total_sales integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id as employee_id,
    p.name as employee_name,
    COALESCE(SUM(
      CASE 
        WHEN o.selling_price_per_unit > pi.threshold_price THEN pi.above_incentive * o.quantity
        ELSE pi.below_incentive * o.quantity
      END
    ), 0) as total_incentive,
    COUNT(o.id)::integer as total_sales
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.created_by = p.id AND to_char(o.order_date, 'YYYY-MM') = target_month
  LEFT JOIN public.product_incentives pi ON pi.product_id = o.product_id
  WHERE p.role = 'employee' OR p.role = 'moderator'
  GROUP BY p.id, p.name
  ORDER BY total_incentive DESC;
$$;

REVOKE ALL ON FUNCTION public.get_employee_incentives(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_incentives(text) TO authenticated;
