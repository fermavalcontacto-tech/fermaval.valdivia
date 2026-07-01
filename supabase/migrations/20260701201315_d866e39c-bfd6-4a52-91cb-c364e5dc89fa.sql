CREATE OR REPLACE FUNCTION public.set_cotizacion_item_variante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_variante_id uuid;
BEGIN
  IF NEW.color_id IS NULL THEN
    NEW.variante_id := NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm, activo, fabricado_m)
  VALUES (NEW.tipo, NEW.color_id, COALESCE(NEW.espesor_mm, 0.4), true, 0)
  ON CONFLICT (tipo, color_id, espesor_mm) DO UPDATE
    SET activo = COALESCE(public.producto_variantes.activo, true),
        updated_at = now()
  RETURNING id INTO v_variante_id;

  IF v_variante_id IS NULL THEN
    SELECT id INTO v_variante_id
    FROM public.producto_variantes
    WHERE tipo = NEW.tipo
      AND color_id = NEW.color_id
      AND espesor_mm = COALESCE(NEW.espesor_mm, 0.4)
    LIMIT 1;
  END IF;

  NEW.variante_id := v_variante_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM anon;
REVOKE ALL ON FUNCTION public.set_cotizacion_item_variante() FROM authenticated;

DROP TRIGGER IF EXISTS trg_set_cotizacion_item_variante ON public.cotizacion_items;
CREATE TRIGGER trg_set_cotizacion_item_variante
BEFORE INSERT OR UPDATE OF color_id, tipo, espesor_mm, variante_id
ON public.cotizacion_items
FOR EACH ROW
EXECUTE FUNCTION public.set_cotizacion_item_variante();