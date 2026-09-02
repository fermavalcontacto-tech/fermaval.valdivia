ALTER TABLE public.cotizacion_items ADD COLUMN IF NOT EXISTS precio_ml numeric;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS precio_ml numeric;