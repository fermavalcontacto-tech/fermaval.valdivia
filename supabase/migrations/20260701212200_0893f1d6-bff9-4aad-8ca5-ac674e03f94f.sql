DROP TRIGGER IF EXISTS set_cotizacion_item_variante_trg ON public.cotizacion_items;
DROP TRIGGER IF EXISTS set_cotizacion_item_variante ON public.cotizacion_items;
DROP TRIGGER IF EXISTS trg_set_cotizacion_item_variante ON public.cotizacion_items;

CREATE OR REPLACE FUNCTION public.set_cotizacion_item_variante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Compatibilidad con versiones antiguas: el inventario real se controla por color/espesor.
  -- Nunca buscar ni exigir producto_variantes por tipo de lata.
  NEW.variante_id := NULL;
  IF NEW.ancho_m IS NULL THEN
    NEW.ancho_m := 1;
  END IF;
  IF NEW.espesor_mm IS NULL THEN
    NEW.espesor_mm := 0.4;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM anon;
REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_cotizacion_item_variante() TO service_role;

UPDATE public.cotizacion_items
SET variante_id = NULL
WHERE variante_id IS NOT NULL;