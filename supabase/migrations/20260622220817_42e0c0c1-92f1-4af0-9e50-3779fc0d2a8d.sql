
CREATE OR REPLACE FUNCTION public.nextval_quote()
RETURNS bigint
LANGUAGE sql
VOLATILE SECURITY DEFINER SET search_path = public
AS $$ SELECT nextval('public.cotizacion_numero_seq'); $$;
REVOKE EXECUTE ON FUNCTION public.nextval_quote() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nextval_quote() TO service_role;
