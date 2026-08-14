ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS giro text;
ALTER TABLE public.clientes ALTER COLUMN nombre SET DEFAULT '';
UPDATE public.clientes SET nombre = '' WHERE nombre IS NULL;