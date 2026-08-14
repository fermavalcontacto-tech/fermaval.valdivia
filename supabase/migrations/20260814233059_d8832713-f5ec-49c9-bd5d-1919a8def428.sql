REVOKE ALL ON FUNCTION public.crear_bobina(text, uuid, numeric, numeric, date, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_bobina(text, uuid, numeric, numeric, date, uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consumir_stock_fifo(uuid, numeric, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_stock_fifo(uuid, numeric, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.nextval_quote() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nextval_quote() TO service_role;

REVOKE ALL ON FUNCTION public.trg_audit_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_egreso_aprobado_bobina() FROM PUBLIC, anon, authenticated;
