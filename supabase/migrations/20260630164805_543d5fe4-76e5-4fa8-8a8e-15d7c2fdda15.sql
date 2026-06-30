
CREATE TABLE public.movimientos_historicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL UNIQUE,
  ventas numeric(14,2) NOT NULL DEFAULT 0,
  gastos numeric(14,2) NOT NULL DEFAULT 0,
  descripcion text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos_historicos TO authenticated;
GRANT ALL ON public.movimientos_historicos TO service_role;

ALTER TABLE public.movimientos_historicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_hist_select_staff" ON public.movimientos_historicos
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "mov_hist_insert_superadmin" ON public.movimientos_historicos
  FOR INSERT TO authenticated
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'fermaval.contacto@gmail.com');

CREATE POLICY "mov_hist_update_superadmin" ON public.movimientos_historicos
  FOR UPDATE TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'fermaval.contacto@gmail.com')
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'fermaval.contacto@gmail.com');

CREATE POLICY "mov_hist_delete_superadmin" ON public.movimientos_historicos
  FOR DELETE TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'fermaval.contacto@gmail.com');

CREATE TRIGGER trg_mov_hist_updated_at
  BEFORE UPDATE ON public.movimientos_historicos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
