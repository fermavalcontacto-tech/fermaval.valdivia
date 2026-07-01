
REVOKE SELECT ON public.colores FROM anon;
GRANT SELECT (id, nombre, hex, imagen_url, activo, orden, created_at) ON public.colores TO anon;

REVOKE SELECT ON public.configuracion_web FROM anon;
GRANT SELECT (id, logo_url, hero_url, hero_titulo, hero_subtitulo, info_comercial, linktree_url, mapa_url, mapa_embed, telefono, direccion, instagram, updated_at, hero_h1_linea1, hero_h1_linea2, hero_h1_linea3, marca_texto, productos_titulo, cotizador_titulo, form_fields)
  ON public.configuracion_web TO anon;
