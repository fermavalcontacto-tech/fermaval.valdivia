CREATE TABLE public.apu_m2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL,
  tipo tipo_producto NOT NULL,
  color_id uuid NOT NULL REFERENCES public.colores(id) ON DELETE CASCADE,
  costo_material numeric NOT NULL DEFAULT 0,
  mano_obra numeric NOT NULL DEFAULT 0,
  otros_costos numeric NOT NULL DEFAULT 0,
  nota text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo, tipo, color_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apu_m2 TO authenticated;
GRANT ALL ON public.apu_m2 TO service_role;
ALTER TABLE public.apu_m2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apu staff read" ON public.apu_m2 FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "apu admin insert" ON public.apu_m2 FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "apu admin update" ON public.apu_m2 FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "apu admin delete" ON public.apu_m2 FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER apu_m2_touch BEFORE UPDATE ON public.apu_m2 FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER apu_m2_audit AFTER INSERT OR UPDATE OR DELETE ON public.apu_m2 FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();