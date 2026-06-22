UPDATE public.configuracion_web SET
  direccion = 'Ruta T-505, Sector Vuelta La Culebra, Parcela #8, Valdivia',
  mapa_url = 'https://www.google.com/maps/search/?api=1&query=' || replace('Ruta T-505, Sector Vuelta La Culebra, Parcela 8, Valdivia, Chile', ' ', '+'),
  mapa_embed = 'https://www.google.com/maps?q=' || replace('Ruta T-505, Vuelta La Culebra, Parcela 8, Valdivia, Chile', ' ', '+') || '&output=embed';

ALTER TABLE public.configuracion_web
  ALTER COLUMN direccion SET DEFAULT 'Ruta T-505, Sector Vuelta La Culebra, Parcela #8, Valdivia',
  ALTER COLUMN mapa_url SET DEFAULT 'https://www.google.com/maps/search/?api=1&query=Ruta+T-505,+Sector+Vuelta+La+Culebra,+Parcela+8,+Valdivia,+Chile',
  ALTER COLUMN mapa_embed SET DEFAULT 'https://www.google.com/maps?q=Ruta+T-505,+Vuelta+La+Culebra,+Parcela+8,+Valdivia,+Chile&output=embed';