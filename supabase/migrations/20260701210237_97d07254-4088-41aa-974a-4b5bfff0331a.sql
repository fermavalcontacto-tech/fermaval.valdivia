DROP TRIGGER IF EXISTS set_cotizacion_item_variante_trg ON public.cotizacion_items;
DROP TRIGGER IF EXISTS set_cotizacion_item_variante ON public.cotizacion_items;
DROP TRIGGER IF EXISTS trg_set_cotizacion_item_variante ON public.cotizacion_items;
DROP FUNCTION IF EXISTS public.set_cotizacion_item_variante();