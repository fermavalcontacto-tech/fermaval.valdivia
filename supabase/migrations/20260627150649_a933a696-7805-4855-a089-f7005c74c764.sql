ALTER TABLE public.configuracion_web
  ADD COLUMN IF NOT EXISTS hero_h1_linea1 text NOT NULL DEFAULT 'CUBIERTAS',
  ADD COLUMN IF NOT EXISTS hero_h1_linea2 text NOT NULL DEFAULT 'Y REVESTIMIENTOS',
  ADD COLUMN IF NOT EXISTS hero_h1_linea3 text NOT NULL DEFAULT 'DE CALIDAD INDUSTRIAL',
  ADD COLUMN IF NOT EXISTS marca_texto text NOT NULL DEFAULT 'Fabricación local en Valdivia. Calidad industrial, precios justos y entrega rápida.',
  ADD COLUMN IF NOT EXISTS productos_titulo text NOT NULL DEFAULT 'COLORES DISPONIBLES',
  ADD COLUMN IF NOT EXISTS cotizador_titulo text NOT NULL DEFAULT 'CALCULA TU PEDIDO';