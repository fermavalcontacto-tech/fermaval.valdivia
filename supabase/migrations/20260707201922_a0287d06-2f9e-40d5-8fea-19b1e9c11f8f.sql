
-- Fix #3: colores.stock_m no debe ser leído por anon.
DROP POLICY IF EXISTS "Anon read active colors" ON public.colores;
REVOKE SELECT ON public.colores FROM anon;

-- Fix #1: mapping de sesiones Getnet ↔ cotización para validar monto en webhook.
CREATE TABLE IF NOT EXISTS public.getnet_sessions (
  request_id BIGINT PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  monto_esperado INTEGER NOT NULL,
  status TEXT,
  monto_aprobado INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.getnet_sessions TO service_role;
ALTER TABLE public.getnet_sessions ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo service_role (edge/server) puede leer/escribir.

-- Fix #2: códigos de verificación por email para historial público.
CREATE TABLE IF NOT EXISTS public.email_verify_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correo TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'quote_history',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verify_codes_correo_purpose_idx
  ON public.email_verify_codes (correo, purpose, created_at DESC);
GRANT ALL ON public.email_verify_codes TO service_role;
ALTER TABLE public.email_verify_codes ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo service_role.
