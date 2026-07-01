REVOKE EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO service_role;