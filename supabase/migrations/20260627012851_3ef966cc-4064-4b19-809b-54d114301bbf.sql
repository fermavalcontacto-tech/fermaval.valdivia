
-- 1) Enum tipo_producto
DO $$ BEGIN
  CREATE TYPE public.tipo_producto AS ENUM ('Ondulado','PV8','PV8 Invertido','Microondulado','6V','PV4','Lata Lisa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabla producto_variantes (stock por tipo+color+espesor)
CREATE TABLE IF NOT EXISTS public.producto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_producto NOT NULL,
  color_id uuid NOT NULL REFERENCES public.colores(id) ON DELETE CASCADE,
  espesor_mm numeric(4,2) NOT NULL DEFAULT 0.4,
  stock_m numeric(12,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, color_id, espesor_mm)
);

GRANT SELECT ON public.producto_variantes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_variantes TO authenticated;
GRANT ALL ON public.producto_variantes TO service_role;

ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variantes_select_all" ON public.producto_variantes
  FOR SELECT USING (true);

CREATE POLICY "variantes_admin_insert" ON public.producto_variantes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "variantes_admin_update" ON public.producto_variantes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "variantes_admin_delete" ON public.producto_variantes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_producto_variantes_updated
  BEFORE UPDATE ON public.producto_variantes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Sembrar variantes para todos los colores existentes (tipo Ondulado + espesor 0.4)
INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm, stock_m)
SELECT 'Ondulado'::public.tipo_producto, c.id, 0.4, COALESCE(c.stock_m, 0)
FROM public.colores c
ON CONFLICT (tipo, color_id, espesor_mm) DO NOTHING;

-- 4) cotizacion_items: tipo + espesor
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS tipo public.tipo_producto NOT NULL DEFAULT 'Ondulado',
  ADD COLUMN IF NOT EXISTS espesor_mm numeric(4,2) NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS variante_id uuid REFERENCES public.producto_variantes(id);

-- 5) cotizaciones: responsable_nombre
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS responsable_nombre text;

-- 6) stock_movimientos: ref a variante
ALTER TABLE public.stock_movimientos
  ADD COLUMN IF NOT EXISTS variante_id uuid REFERENCES public.producto_variantes(id),
  ADD COLUMN IF NOT EXISTS tipo public.tipo_producto,
  ADD COLUMN IF NOT EXISTS espesor_mm numeric(4,2);
