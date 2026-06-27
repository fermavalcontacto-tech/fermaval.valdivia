ALTER TABLE public.solicitudes_egreso
ADD COLUMN IF NOT EXISTS latas jsonb NOT NULL DEFAULT '[]'::jsonb;