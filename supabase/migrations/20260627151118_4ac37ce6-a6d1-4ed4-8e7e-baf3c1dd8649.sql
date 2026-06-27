ALTER TABLE public.configuracion_web
  ADD COLUMN IF NOT EXISTS form_fields jsonb NOT NULL DEFAULT '{
    "nombre":    {"label":"Nombre",    "visible":true, "required":true},
    "telefono":  {"label":"Teléfono",  "visible":true, "required":true},
    "correo":    {"label":"Correo",    "visible":true, "required":true},
    "direccion": {"label":"Dirección", "visible":true, "required":true}
  }'::jsonb;