
-- 1. colores: revoke anon access to stock_m column
REVOKE SELECT ON public.colores FROM anon;
GRANT SELECT (id, nombre, hex, imagen_url, activo, orden, created_at) ON public.colores TO anon;

-- 2. producto_variantes: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "variantes_select_all" ON public.producto_variantes;
CREATE POLICY "variantes_select_authenticated"
  ON public.producto_variantes
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.producto_variantes FROM anon;
