
-- Cotizaciones: only superadmin can delete
DROP POLICY IF EXISTS "Staff delete quotes" ON public.cotizaciones;
CREATE POLICY "Superadmin delete quotes"
ON public.cotizaciones FOR DELETE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

-- Boletas: split staff ALL into INSERT/SELECT for staff, UPDATE/DELETE for superadmin
DROP POLICY IF EXISTS "Staff manage receipts" ON public.boletas;
CREATE POLICY "Staff read receipts"
ON public.boletas FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert receipts"
ON public.boletas FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Superadmin update receipts"
ON public.boletas FOR UPDATE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');
CREATE POLICY "Superadmin delete receipts"
ON public.boletas FOR DELETE TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'fermaval.contacto@gmail.com');

-- Audit log: allow staff to insert (so we can also log non-superadmin actions like creating cotizaciones); reads stay superadmin-only
DROP POLICY IF EXISTS "Superadmin insert audit" ON public.config_audit_log;
CREATE POLICY "Staff insert audit"
ON public.config_audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));
