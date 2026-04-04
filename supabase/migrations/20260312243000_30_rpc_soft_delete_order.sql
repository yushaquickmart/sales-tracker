/*
  # Fix moderator soft-delete RLS failures via RPC

  Some environments still reject client UPDATE due to RLS WITH CHECK evaluation.
  Provide a SECURITY DEFINER RPC that:
  - Verifies caller is moderator/admin using their own profile row
  - Marks an order as deleted (deleted_at/deleted_by)
  - Returns the updated row
*/

CREATE OR REPLACE FUNCTION public.soft_delete_order(order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  UPDATE public.orders o
  SET deleted_at = now(),
      deleted_by = auth.uid()
  WHERE o.id = order_id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_order(uuid) TO authenticated;

