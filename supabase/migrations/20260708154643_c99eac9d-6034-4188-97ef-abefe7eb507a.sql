
DROP TABLE IF EXISTS public.getnet_sessions CASCADE;

CREATE TABLE public.getnet_sessions (
  request_id BIGINT NOT NULL PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  checkout_url TEXT,
  status TEXT,
  monto_esperado INTEGER NOT NULL,
  monto_aprobado INTEGER,
  payment_date TIMESTAMP WITH TIME ZONE,
  expiration_date TIMESTAMP WITH TIME ZONE,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX getnet_sessions_cotizacion_idx ON public.getnet_sessions(cotizacion_id);
CREATE INDEX getnet_sessions_status_idx ON public.getnet_sessions(status);
CREATE INDEX getnet_sessions_created_idx ON public.getnet_sessions(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_sessions TO authenticated;
GRANT ALL ON public.getnet_sessions TO service_role;

ALTER TABLE public.getnet_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read getnet sessions" ON public.getnet_sessions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert getnet sessions" ON public.getnet_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update getnet sessions" ON public.getnet_sessions
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER getnet_sessions_touch
  BEFORE UPDATE ON public.getnet_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
