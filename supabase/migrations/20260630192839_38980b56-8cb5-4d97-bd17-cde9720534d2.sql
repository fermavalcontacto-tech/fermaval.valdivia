
ALTER TABLE public.producto_variantes
  ADD COLUMN IF NOT EXISTS fabricado_m numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.colores
  ALTER COLUMN stock_m SET DEFAULT 1400;

UPDATE public.colores SET stock_m = 1400 WHERE activo = true;
UPDATE public.producto_variantes SET fabricado_m = 0;
