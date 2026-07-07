
REVOKE EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO service_role;
