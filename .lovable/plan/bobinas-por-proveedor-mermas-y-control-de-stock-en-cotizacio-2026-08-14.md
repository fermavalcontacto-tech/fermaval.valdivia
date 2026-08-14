# Bobinas por proveedor, mermas y control de stock en cotizaciones

## Qué se agrega

1. **Bobinas por proveedor (lotes FIFO)**
   - Nuevo apartado "Bobinas" en el panel: proveedor, color, metros comprados, valor pagado, fecha de ingreso, saldo disponible.
   - Cada bobina ingresa con el **99% de los metros como útiles** (ancho útil 1 m, por lo que 1 metro lineal = 1 m²).
   - El **1% restante queda registrado como pérdida** (metros y m² de pérdida) y se ve en el listado y en los reportes.
   - El consumo es **FIFO**: se descuenta primero la bobina más antigua de ese color.

2. **Egresos con proveedor y valor**
   - En cada Solicitud de Egreso se agregan: **Proveedor**, **Valor**, **Color** y **Metros de bobina** (opcionales).
   - Cuando el egreso se **aprueba** y trae metros de bobina, se crea automáticamente la bobina y **el stock del color se actualiza solo** (99% útil, 1% merma).
   - Con valor + metros se calcula automáticamente el **costo por m²** y, contra el precio de venta del tipo, la **ganancia por m² ($ y %)**.

3. **Cotizaciones con alerta roja de stock**
   - Al cotizar desde el panel, cada línea muestra la **bobina asignada** (proveedor + saldo).
   - Si los metros de la línea **exceden el saldo de esa bobina**, la línea se marca en **rojo** con el detalle del faltante.
   - El administrador puede **cambiar de bobina / proveedor** en un selector que muestra el saldo de cada una (sugerencia FIFO por defecto).
   - Lo mismo aplica al **editar una cotización ya creada de un cliente**: se puede reasignar bobina y corregir metros con la misma alerta.

4. **Métricas**
   - Tarjeta con **m² de pérdida** acumulada (por mes y por color) en Finanzas/Reportes.
   - En cada cotización, la **ganancia por m²** usa el costo real de la bobina consumida.

## Detalles técnicos

**Base de datos (una migración)**
- `public.bobinas`: `id`, `proveedor`, `color_id`, `metros_comprados`, `metros_utiles` (99%), `metros_perdida` (1%), `saldo_m`, `valor_total`, `costo_m2` (generado = valor/metros_utiles), `fecha_ingreso`, `egreso_id` (nullable), `created_by`, timestamps. GRANT a `authenticated` + `service_role`, RLS: lectura/escritura solo staff (`is_staff`), borrado solo `admin`.
- `public.bobina_consumos`: `bobina_id`, `cotizacion_id`, `cotizacion_item_id`, `metros`, `costo_m2_snapshot`, `created_at` — trazabilidad FIFO. Mismos grants/RLS.
- `solicitudes_egreso`: nuevas columnas `proveedor text`, `valor numeric`, `bobina_color_id uuid`, `bobina_metros numeric` (todas nullable, no se toca nada histórico).
- `cotizacion_items`: nueva columna `bobina_id uuid null` (asignación manual/FIFO).
- Función `public.consumir_stock_fifo(color_id, metros, cotizacion_id, item_id)` (security definer) que descuenta por FIFO, escribe `bobina_consumos` y `stock_movimientos`, y devuelve el costo m² ponderado.
- Trigger en `solicitudes_egreso` (AFTER UPDATE a `aprobado`): si trae `bobina_metros` y `bobina_color_id`, crea la bobina, suma el 99% a `colores.stock_m` y registra el movimiento de merma del 1%.
- Vista `public.v_perdidas_m2` (mes, color, m² de pérdida) para las tarjetas.

**Código**
- `src/lib/domain/quotes.core.ts`: `ANCHO_UTIL_M = 1`, `MERMA_BOBINA = 0.01`, helpers `metrosUtiles`, `perdidaBobina`, `costoM2Bobina`, `gananciaM2` reutilizando `margenM2` existente.
- `src/lib/admin.functions.ts`: `listBobinas`, `createBobina`, `updateBobina`, `deleteBobina` (solo admin), `listBobinasPorColor` (saldos para el selector), `listPerdidas`; ampliar `createEgreso`/`decideEgreso` con proveedor/valor/metros; `createCotizacion`/`updateCotizacion` pasan `bobina_id` y usan `consumir_stock_fifo` en lugar del descuento plano actual (manteniendo la devolución al stock en cancelación).
- Nueva ruta `src/routes/_authenticated.admin.bobinas.tsx` + enlace en el sidebar: tabla por proveedor con saldo, costo m², merma y ganancia m² estimada.
- `src/routes/_authenticated.admin.egresos.tsx`: campos Proveedor, Valor, Color y Metros en el formulario; columnas nuevas en la tabla y en la exportación.
- `src/routes/_authenticated.admin.cotizaciones.tsx`: selector de bobina por línea, borde/badge rojo cuando `metros > saldo`, aviso de faltante y sugerencia FIFO; misma UI en el diálogo de edición.
- `src/routes/_authenticated.admin.finanzas.tsx` / `reportes`: tarjeta "m² de pérdida" y columna de merma.

**Compatibilidad**
- Nada se elimina: `colores.stock_m` sigue siendo el total del color (suma de saldos de bobinas) y los movimientos históricos quedan intactos. Las cotizaciones antiguas sin `bobina_id` siguen funcionando con el consumo FIFO automático.
