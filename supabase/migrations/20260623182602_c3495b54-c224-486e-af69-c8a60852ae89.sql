-- 1) Cotizaciones: drop public-read, require staff
DROP POLICY IF EXISTS "Public read quotes" ON public.cotizaciones;
CREATE POLICY "Staff read quotes" ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2) user_roles: hard-lock writes from clients (defense in depth).
--    No INSERT/UPDATE/DELETE policy exists today so PostgREST already denies,
--    but explicit restrictive policies prevent any future permissive policy
--    from accidentally enabling self-role-assignment.
DROP POLICY IF EXISTS "Block client inserts on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block client updates on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block client deletes on user_roles" ON public.user_roles;
CREATE POLICY "Block client inserts on user_roles" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Block client updates on user_roles" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes on user_roles" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 3) Switch helper functions from SECURITY DEFINER to SECURITY INVOKER.
--    All callers pass auth.uid(), and the "View own role" SELECT policy lets
--    each authenticated user see their own user_roles row, so an invoker-side
--    EXISTS check still returns the correct result. This removes the privileged
--    definer functions from the exposed API.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;
