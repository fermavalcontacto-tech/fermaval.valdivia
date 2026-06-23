-- Replace previous admin-update policy with an email-restricted one
DROP POLICY IF EXISTS "Admin update any" ON public.solicitudes_egreso;
DROP POLICY IF EXISTS "Admin delete" ON public.solicitudes_egreso;

CREATE POLICY "Superadmin decide egresos"
ON public.solicitudes_egreso
FOR UPDATE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'fermaval.contacto@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'fermaval.contacto@gmail.com');

CREATE POLICY "Superadmin delete egresos"
ON public.solicitudes_egreso
FOR DELETE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'fermaval.contacto@gmail.com');