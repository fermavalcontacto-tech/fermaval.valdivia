-- Defense in depth: strip anon column-level access to internal stock fields.
REVOKE SELECT (stock_m) ON public.colores FROM anon;
REVOKE UPDATE (stock_m) ON public.colores FROM anon;
REVOKE SELECT (fabricado_m) ON public.producto_variantes FROM anon;

-- Safe public projection (no stock_m). Uses SECURITY INVOKER so RLS still applies.
CREATE OR REPLACE VIEW public.colores_publicos
WITH (security_invoker = true) AS
SELECT id, nombre, hex, imagen_url, activo, orden, created_at
FROM public.colores
WHERE activo = true;

GRANT SELECT ON public.colores_publicos TO anon, authenticated;