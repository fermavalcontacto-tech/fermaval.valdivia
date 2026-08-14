CREATE TABLE public.utilidad_m2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL UNIQUE,
  utilidad_m2 numeric NOT NULL DEFAULT 0,
  nota text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utilidad_m2 TO authenticated;
GRANT ALL ON public.utilidad_m2 TO service_role;

ALTER TABLE public.utilidad_m2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff pueden ver utilidad" ON public.utilidad_m2
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin inserta utilidad" ON public.utilidad_m2
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin edita utilidad" ON public.utilidad_m2
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin borra utilidad" ON public.utilidad_m2
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_utilidad_m2_touch BEFORE UPDATE ON public.utilidad_m2
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_utilidad_m2_audit AFTER INSERT OR UPDATE OR DELETE ON public.utilidad_m2
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();