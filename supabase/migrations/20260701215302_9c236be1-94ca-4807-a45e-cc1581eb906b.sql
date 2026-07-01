-- Eliminar cualquier trigger heredado que pueda tocar variante_id en cotizacion_items.
DROP TRIGGER IF EXISTS trg_set_cotizacion_item_variante ON public.cotizacion_items;
DROP TRIGGER IF EXISTS set_cotizacion_item_variante ON public.cotizacion_items;
DROP TRIGGER IF EXISTS cotizacion_items_set_variante ON public.cotizacion_items;

-- Eliminar la función heredada de compatibilidad para que no exista ninguna
-- lógica de base asociando o validando producto_variantes al cotizar.
DROP FUNCTION IF EXISTS public.set_cotizacion_item_variante();

-- Asegurar que cotizacion_items nunca requiera una variante.
ALTER TABLE public.cotizacion_items
  ALTER COLUMN variante_id DROP NOT NULL,
  ALTER COLUMN ancho_m SET DEFAULT 1,
  ALTER COLUMN espesor_mm SET DEFAULT 0.4;

-- Limpiar registros históricos para que la app ya no dependa de producto_variantes.
UPDATE public.cotizacion_items
SET variante_id = NULL
WHERE variante_id IS NOT NULL;

-- Quitar la llave foránea opcional para evitar cualquier bloqueo por una variante inexistente.
ALTER TABLE public.cotizacion_items
  DROP CONSTRAINT IF EXISTS cotizacion_items_variante_id_fkey;