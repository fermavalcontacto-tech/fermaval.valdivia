-- Fix permission denied for function is_staff / has_role
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- Promote the 4 administrative accounts to the single ADMINISTRADOR GENERAL role ('admin')
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN (
  'bayrontorresnaipil@gmail.com',
  'freddy.torres.oliva@gmail.com',
  'ocatorr32@gmail.com',
  'fermaval.contacto@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove any non-admin role assignments for those 4 accounts (single role only)
DELETE FROM public.user_roles
WHERE role <> 'admin'
  AND user_id IN (
    SELECT id FROM auth.users WHERE lower(email) IN (
      'bayrontorresnaipil@gmail.com',
      'freddy.torres.oliva@gmail.com',
      'ocatorr32@gmail.com',
      'fermaval.contacto@gmail.com'
    )
  );