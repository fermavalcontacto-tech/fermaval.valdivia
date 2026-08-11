CREATE TABLE public.precios_tipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_producto NOT NULL UNIQUE,
  precio_m2 numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.precios_tipo TO authenticated;
GRANT ALL ON public.precios_tipo TO service_role;

ALTER TABLE public.precios_tipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff puede ver precios" ON public.precios_tipo
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin inserta precios" ON public.precios_tipo
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin actualiza precios" ON public.precios_tipo
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin elimina precios" ON public.precios_tipo
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER precios_tipo_touch BEFORE UPDATE ON public.precios_tipo
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_precios_tipo AFTER INSERT OR UPDATE OR DELETE ON public.precios_tipo
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();

INSERT INTO public.precios_tipo (tipo, precio_m2)
SELECT t.tipo, COALESCE((SELECT precio_m2 FROM public.configuracion_web WHERE id = 1), 7990)
FROM (VALUES
  ('Ondulado'::public.tipo_producto),
  ('PV8'::public.tipo_producto),
  ('PV8 Invertido'::public.tipo_producto),
  ('Microondulado'::public.tipo_producto),
  ('6V'::public.tipo_producto),
  ('PV4'::public.tipo_producto),
  ('Lata Lisa'::public.tipo_producto)
) AS t(tipo)
ON CONFLICT (tipo) DO NOTHING;

ALTER TABLE public.cotizacion_items ADD COLUMN IF NOT EXISTS precio_m2 numeric;

UPDATE public.cotizacion_items ci
SET precio_m2 = c.precio_m2
FROM public.cotizaciones c
WHERE ci.cotizacion_id = c.id AND ci.precio_m2 IS NULL;