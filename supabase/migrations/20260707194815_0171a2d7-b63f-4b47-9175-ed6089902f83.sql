-- Limpieza defensiva definitiva del modelo antiguo de variantes Tipo + Color.
-- El inventario real queda exclusivamente en public.colores.stock_m.

DO $$
BEGIN
  IF to_regclass('public.producto_variantes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_producto_variantes ON public.producto_variantes;
  END IF;

  IF to_regclass('public.colores') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_autogen_variants_for_color ON public.colores;
  END IF;

  IF to_regclass('public.cotizacion_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_cotizacion_item_variant ON public.cotizacion_items;
    DROP TRIGGER IF EXISTS set_cotizacion_item_variante_trg ON public.cotizacion_items;
    DROP TRIGGER IF EXISTS set_cotizacion_item_variante ON public.cotizacion_items;
    DROP TRIGGER IF EXISTS trg_set_cotizacion_item_variante ON public.cotizacion_items;
    DROP TRIGGER IF EXISTS cotizacion_items_set_variante ON public.cotizacion_items;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.trg_autogen_variants_for_color() CASCADE;
DROP FUNCTION IF EXISTS public.trg_fill_variante_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_cotizacion_item_variante() CASCADE;
DROP FUNCTION IF EXISTS public.fetch_or_create_variant(text, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_variant(text, uuid, numeric) CASCADE;

ALTER TABLE IF EXISTS public.cotizacion_items DROP COLUMN IF EXISTS variante_id;
ALTER TABLE IF EXISTS public.stock_movimientos DROP COLUMN IF EXISTS variante_id;

DROP TABLE IF EXISTS public.producto_variantes CASCADE;

-- Compatibilidad defensiva: si alguna llamada antigua queda cacheada, no debe volver a lanzar
-- "No existe variante..." ni crear dependencia con una tabla eliminada.
CREATE OR REPLACE FUNCTION public.ensure_variant(_tipo text, _color_id uuid, _espesor_mm numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_variant(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.fetch_or_create_variant(_tipo text, _color_id uuid, _espesor_mm numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO service_role;