ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS access_token text;

-- Backfill existing rows with a random URL-safe token
UPDATE public.cotizaciones
SET access_token = encode(extensions.gen_random_bytes(18), 'base64')
WHERE access_token IS NULL;

-- Strip base64 chars that are awkward in URLs
UPDATE public.cotizaciones
SET access_token = replace(replace(replace(access_token, '+', ''), '/', ''), '=', '')
WHERE access_token ~ '[+/=]';

ALTER TABLE public.cotizaciones ALTER COLUMN access_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cotizaciones_access_token_key ON public.cotizaciones(access_token);