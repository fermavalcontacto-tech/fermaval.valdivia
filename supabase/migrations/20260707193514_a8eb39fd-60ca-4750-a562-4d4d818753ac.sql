
-- 1. Quitar trigger de auditoría sobre producto_variantes (si existe)
DROP TRIGGER IF EXISTS audit_producto_variantes ON public.producto_variantes;

-- 2. Quitar trigger que autogenera variantes al crear color
DROP TRIGGER IF EXISTS trg_autogen_variants_for_color ON public.colores;

-- 3. Quitar trigger que autorellena variante_id en cotizacion_items
DROP TRIGGER IF EXISTS trg_cotizacion_item_variant ON public.cotizacion_items;

-- 4. Quitar funciones asociadas al modelo de variantes
DROP FUNCTION IF EXISTS public.trg_autogen_variants_for_color() CASCADE;
DROP FUNCTION IF EXISTS public.trg_fill_variante_id() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_variant(text, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fetch_or_create_variant(text, uuid, numeric) CASCADE;

-- 5. Quitar columna variante_id de tablas hijas
ALTER TABLE public.cotizacion_items DROP COLUMN IF EXISTS variante_id;
ALTER TABLE public.stock_movimientos DROP COLUMN IF EXISTS variante_id;

-- 6. Dropear tabla de variantes
DROP TABLE IF EXISTS public.producto_variantes CASCADE;

-- 7. Agregar los nuevos tipos de fabricación oficiales al enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Trapezoidal'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'Trapezoidal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Minionda'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'Minionda';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PV6'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'PV6';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Teja Continua'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'Teja Continua';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Teja Colonial'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'Teja Colonial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Teja Española'
    AND enumtypid = 'public.tipo_producto'::regtype) THEN
    ALTER TYPE public.tipo_producto ADD VALUE 'Teja Española';
  END IF;
END $$;
