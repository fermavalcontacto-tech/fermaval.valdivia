-- Limpieza final del modelo eliminado de variantes de stock.
-- El inventario real queda basado solo en colores.stock_m.

DROP FUNCTION IF EXISTS public.ensure_variant(text, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fetch_or_create_variant(text, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_variant(public.tipo_producto, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fetch_or_create_variant(public.tipo_producto, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.trg_fill_variante_id() CASCADE;
DROP FUNCTION IF EXISTS public.trg_autogen_variants_for_color() CASCADE;
DROP FUNCTION IF EXISTS public.trg_cotizacion_item_variant() CASCADE;
DROP FUNCTION IF EXISTS public.sync_variant_stock_from_color() CASCADE;

ALTER TABLE IF EXISTS public.cotizacion_items DROP COLUMN IF EXISTS variante_id;
ALTER TABLE IF EXISTS public.stock_movimientos DROP COLUMN IF EXISTS variante_id;
DROP TABLE IF EXISTS public.producto_variantes CASCADE;

-- Pedir al API del backend que refresque su caché de esquema inmediatamente.
NOTIFY pgrst, 'reload schema';