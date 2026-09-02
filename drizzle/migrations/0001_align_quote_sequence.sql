-- Alinear el contador de folios con el mayor folio correlativo existente (FV-#####)
DO $$
DECLARE
  v_max bigint;
  v_cur bigint;
BEGIN
  SELECT COALESCE(MAX(regexp_replace(numero, '\D', '', 'g')::bigint), 0)
    INTO v_max
  FROM public.cotizaciones
  WHERE numero ~ '^FV-[0-9]{1,5}$';

  SELECT last_value INTO v_cur FROM public.cotizacion_numero_seq;

  PERFORM setval('public.cotizacion_numero_seq', GREATEST(v_max, COALESCE(v_cur, 1)), true);
END $$;

GRANT EXECUTE ON FUNCTION public.nextval_quote() TO authenticated, anon, service_role;
