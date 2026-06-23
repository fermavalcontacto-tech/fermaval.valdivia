
-- Tighten configuracion_web update policy: only superadmin email
DROP POLICY IF EXISTS "Admin update config" ON public.configuracion_web;
CREATE POLICY "Superadmin update config"
ON public.configuracion_web
FOR UPDATE
TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

-- Tighten colores write policies: only superadmin email
DROP POLICY IF EXISTS "Admin manage colors" ON public.colores;
CREATE POLICY "Superadmin insert colors"
ON public.colores FOR INSERT TO authenticated
WITH CHECK (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');
CREATE POLICY "Superadmin update colors"
ON public.colores FOR UPDATE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');
CREATE POLICY "Superadmin delete colors"
ON public.colores FOR DELETE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

-- Audit log table
CREATE TABLE IF NOT EXISTS public.config_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  entidad text NOT NULL,
  accion text NOT NULL,
  cambio text NOT NULL,
  valor_antes text,
  valor_despues text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.config_audit_log TO authenticated;
GRANT ALL ON public.config_audit_log TO service_role;

ALTER TABLE public.config_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin read audit"
ON public.config_audit_log FOR SELECT TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

CREATE POLICY "Superadmin insert audit"
ON public.config_audit_log FOR INSERT TO authenticated
WITH CHECK (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

CREATE INDEX IF NOT EXISTS config_audit_log_created_at_idx
ON public.config_audit_log (created_at DESC);
