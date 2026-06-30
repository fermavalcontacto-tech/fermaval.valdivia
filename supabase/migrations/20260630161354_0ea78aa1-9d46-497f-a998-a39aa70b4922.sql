
-- colores: hide stock_m from anonymous public users via column grants
DROP POLICY IF EXISTS "Public read colors" ON public.colores;
CREATE POLICY "Anon read active colors" ON public.colores FOR SELECT TO anon USING (activo = true);
CREATE POLICY "Authenticated read colors" ON public.colores FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.colores FROM anon;
GRANT SELECT (id, nombre, hex, imagen_url, activo, orden, created_at) ON public.colores TO anon;

-- producto_variantes: restrict reads to staff only
DROP POLICY IF EXISTS "variantes_select_authenticated" ON public.producto_variantes;
CREATE POLICY "variantes_select_staff" ON public.producto_variantes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
