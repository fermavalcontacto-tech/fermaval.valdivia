-- Add estado_pedido to cotizaciones for order tracking
DO $$ BEGIN
  CREATE TYPE public.estado_pedido AS ENUM ('en_preparacion','en_produccion','pedido_entregado','finalizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS estado_pedido public.estado_pedido NOT NULL DEFAULT 'en_preparacion';

CREATE INDEX IF NOT EXISTS cotizaciones_estado_pedido_idx ON public.cotizaciones(estado_pedido);
CREATE INDEX IF NOT EXISTS cotizaciones_numero_idx ON public.cotizaciones(numero);
CREATE INDEX IF NOT EXISTS cotizaciones_created_at_idx ON public.cotizaciones(created_at DESC);