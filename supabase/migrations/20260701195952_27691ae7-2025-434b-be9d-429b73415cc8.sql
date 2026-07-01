DROP POLICY IF EXISTS variantes_admin_insert ON public.producto_variantes;
CREATE POLICY variantes_staff_insert ON public.producto_variantes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- También poblamos ya las variantes faltantes para todas las combinaciones
-- de tipo × color × 0.4mm, para que ninguna cotización falle.
INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm)
SELECT t.tipo::tipo_producto, c.id, 0.4
FROM public.colores c
CROSS JOIN (VALUES ('Ondulado'),('PV8'),('PV8 Invertido'),('Microondulado'),('6V'),('PV4'),('Lata Lisa')) AS t(tipo)
WHERE c.activo = true
ON CONFLICT DO NOTHING;