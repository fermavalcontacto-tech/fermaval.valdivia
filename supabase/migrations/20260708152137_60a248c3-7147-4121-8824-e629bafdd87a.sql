
-- Drop old getnet_sessions (PlacetoPay schema); no functional data in production
DROP TABLE IF EXISTS public.getnet_sessions CASCADE;

CREATE TABLE public.getnet_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  payment_id_getnet TEXT,
  checkout_url TEXT,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendiente',
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  payment_date TIMESTAMP WITH TIME ZONE,
  expiration_date TIMESTAMP WITH TIME ZONE,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX getnet_sessions_cotizacion_id_idx ON public.getnet_sessions(cotizacion_id);
CREATE INDEX getnet_sessions_payment_id_idx ON public.getnet_sessions(payment_id_getnet);
CREATE INDEX getnet_sessions_status_idx ON public.getnet_sessions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_sessions TO authenticated;
GRANT ALL ON public.getnet_sessions TO service_role;

ALTER TABLE public.getnet_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read getnet sessions" ON public.getnet_sessions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff write getnet sessions" ON public.getnet_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update getnet sessions" ON public.getnet_sessions
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER getnet_sessions_touch
  BEFORE UPDATE ON public.getnet_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
