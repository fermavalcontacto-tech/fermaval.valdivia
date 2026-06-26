
-- Add origen to cotizaciones to differentiate cliente vs interno
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'cliente'
    CHECK (origen IN ('cliente','interno'));

-- Create cotizacion_items table for multiple plancha measurements per quote
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  largo_m numeric(10,2) NOT NULL CHECK (largo_m > 0),
  ancho_m numeric(10,2) NOT NULL DEFAULT 1,
  cantidad_planchas int NOT NULL DEFAULT 1 CHECK (cantidad_planchas > 0),
  metros2 numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotizacion_items_cotizacion_id_idx
  ON public.cotizacion_items(cotizacion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_items TO authenticated;
GRANT ALL ON public.cotizacion_items TO service_role;

ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;

-- Staff (anyone with a role in user_roles) can read/write items.
CREATE POLICY "staff can view items"
  ON public.cotizacion_items FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "staff can insert items"
  ON public.cotizacion_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff can update items"
  ON public.cotizacion_items FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff can delete items"
  ON public.cotizacion_items FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Backfill: create one item per existing cotización from legacy columns.
INSERT INTO public.cotizacion_items (cotizacion_id, position, largo_m, ancho_m, cantidad_planchas, metros2)
SELECT c.id, 0, c.largo_m, COALESCE(c.ancho_m, 1), COALESCE(c.cantidad_planchas, 1), c.metros2
FROM public.cotizaciones c
LEFT JOIN public.cotizacion_items i ON i.cotizacion_id = c.id
WHERE i.id IS NULL;
