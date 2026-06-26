ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS cantidad_planchas integer NOT NULL DEFAULT 1;

ALTER TABLE public.cotizaciones
  ALTER COLUMN ancho_m SET DEFAULT 1;