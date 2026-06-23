
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS descuento numeric NOT NULL DEFAULT 0;
