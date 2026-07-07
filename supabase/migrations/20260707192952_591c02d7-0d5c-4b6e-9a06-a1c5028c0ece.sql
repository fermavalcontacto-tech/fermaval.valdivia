
CREATE OR REPLACE VIEW public.v_alertas
WITH (security_invoker = true) AS
SELECT
  'cotizacion_vencida'::text AS tipo,
  'alta'::text AS severidad,
  c.id::text AS registro_id,
  format('Cotización %s vencida', c.numero) AS mensaje,
  c.created_at AS ocurrido_at,
  jsonb_build_object('numero', c.numero, 'estado', c.estado::text, 'total', c.total) AS meta
FROM public.cotizaciones c
WHERE c.estado = 'cotizacion_creada'
  AND c.created_at < now() - (c.plazo_horas || ' hours')::interval

UNION ALL

SELECT
  'saldo_pendiente'::text,
  CASE WHEN c.saldo > c.total * 0.5 THEN 'alta' ELSE 'media' END,
  c.id::text,
  format('Cotización %s con saldo pendiente $%s', c.numero, to_char(c.saldo, 'FM999G999G999')),
  c.updated_at,
  jsonb_build_object('numero', c.numero, 'saldo', c.saldo, 'total', c.total)
FROM public.cotizaciones c
WHERE c.saldo > 0
  AND c.estado IN ('esperando_pago','pago_parcial','pedido_confirmado','pedido_terminado')

UNION ALL

SELECT
  'stock_bajo'::text,
  CASE WHEN co.stock_m <= 0 THEN 'alta' WHEN co.stock_m < 50 THEN 'media' ELSE 'baja' END,
  co.id::text,
  format('Color %s con %s m de materia prima', co.nombre, to_char(co.stock_m, 'FM999G999D00')),
  now(),
  jsonb_build_object('color', co.nombre, 'stock_m', co.stock_m, 'hex', co.hex)
FROM public.colores co
WHERE co.activo = true
  AND COALESCE(co.stock_m, 0) < 100;

GRANT SELECT ON public.v_alertas TO authenticated;
