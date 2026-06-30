-- Restore grants on public.colores that were stripped, breaking the admin matrix.
GRANT SELECT (id, nombre, hex, imagen_url, activo, orden, created_at) ON public.colores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colores TO authenticated;
GRANT ALL ON public.colores TO service_role;