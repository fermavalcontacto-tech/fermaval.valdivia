CREATE OR REPLACE FUNCTION public.ensure_variant(_tipo text, _color_id uuid, _espesor_mm numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_variant(text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.fetch_or_create_variant(_tipo text, _color_id uuid, _espesor_mm numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO service_role;