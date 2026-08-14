CREATE TABLE public.costos_m2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL,
  tipo tipo_producto NOT NULL,
  costo_m2 numeric NOT NULL DEFAULT 0,
  nota text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costos_m2 TO authenticated;
GRANT ALL ON public.costos_m2 TO service_role;

ALTER TABLE public.costos_m2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_costos_m2" ON public.costos_m2 FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_insert_costos_m2" ON public.costos_m2 FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff_update_costos_m2" ON public.costos_m2 FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admin_delete_costos_m2" ON public.costos_m2 FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_costos_m2_touch BEFORE UPDATE ON public.costos_m2 FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_costos_m2_audit AFTER INSERT OR UPDATE OR DELETE ON public.costos_m2 FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();

ALTER TABLE public.configuracion_web ADD COLUMN IF NOT EXISTS precio_cliente_modo text NOT NULL DEFAULT 'neto';
ALTER TABLE public.configuracion_web ADD CONSTRAINT configuracion_web_precio_cliente_modo_check CHECK (precio_cliente_modo IN ('neto','bruto'));