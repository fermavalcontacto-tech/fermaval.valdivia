
-- Stock en metros por color
ALTER TABLE public.colores ADD COLUMN IF NOT EXISTS stock_m numeric(12,2) NOT NULL DEFAULT 0;

-- Color por línea de cotización (snapshot del nombre por si el color se elimina)
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS color_id uuid REFERENCES public.colores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color_nombre text;
CREATE INDEX IF NOT EXISTS cotizacion_items_color_id_idx ON public.cotizacion_items(color_id);

-- Marca para evitar doble descuento de stock al confirmar pedido
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS stock_descontado_at timestamptz;

-- Historial de movimientos de stock
CREATE TABLE IF NOT EXISTS public.stock_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color_id uuid REFERENCES public.colores(id) ON DELETE SET NULL,
  color_nombre text,
  cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  cotizacion_numero text,
  metros numeric(12,2) NOT NULL,
  motivo text NOT NULL,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movimientos TO authenticated;
GRANT ALL ON public.stock_movimientos TO service_role;
ALTER TABLE public.stock_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read stock movs" ON public.stock_movimientos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert stock movs" ON public.stock_movimientos FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Reabrir gestión de colores a cualquier staff (no solo superadmin)
DROP POLICY IF EXISTS "Superadmin insert colors" ON public.colores;
DROP POLICY IF EXISTS "Superadmin update colors" ON public.colores;
DROP POLICY IF EXISTS "Superadmin delete colors" ON public.colores;
CREATE POLICY "Staff insert colors" ON public.colores FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update colors" ON public.colores FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete colors" ON public.colores FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
