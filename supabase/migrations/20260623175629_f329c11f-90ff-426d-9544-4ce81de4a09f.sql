-- Add traceability fields to solicitudes_egreso
ALTER TABLE public.solicitudes_egreso
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
  ADD COLUMN IF NOT EXISTS boleta_subida_por TEXT;

-- Default value for legacy rows
UPDATE public.solicitudes_egreso SET solicitado_por = 'Freddy' WHERE solicitado_por IS NULL;

ALTER TABLE public.solicitudes_egreso
  ALTER COLUMN solicitado_por SET NOT NULL,
  ADD CONSTRAINT solicitado_por_valido CHECK (solicitado_por IN ('Freddy','Bayron','Oscar')),
  ADD CONSTRAINT boleta_subida_por_valido CHECK (boleta_subida_por IS NULL OR boleta_subida_por IN ('Freddy','Bayron','Oscar'));

-- DELETE policy: only superadmin
DROP POLICY IF EXISTS "Superadmin delete egresos" ON public.solicitudes_egreso;
CREATE POLICY "Superadmin delete egresos" ON public.solicitudes_egreso
  FOR DELETE TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'fermaval.contacto@gmail.com');