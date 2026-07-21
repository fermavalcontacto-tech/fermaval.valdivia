CREATE TABLE public.ventas_chatarra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT current_date,
  monto numeric(12,0) NOT NULL CHECK (monto >= 0),
  descripcion text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas_chatarra TO authenticated;
GRANT ALL ON public.ventas_chatarra TO service_role;

ALTER TABLE public.ventas_chatarra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ventas_chatarra"
  ON public.ventas_chatarra FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert ventas_chatarra"
  ON public.ventas_chatarra FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update ventas_chatarra"
  ON public.ventas_chatarra FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete ventas_chatarra"
  ON public.ventas_chatarra FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_ventas_chatarra_touch
  BEFORE UPDATE ON public.ventas_chatarra
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_ventas_chatarra_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ventas_chatarra
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();

CREATE INDEX idx_ventas_chatarra_fecha ON public.ventas_chatarra(fecha DESC);