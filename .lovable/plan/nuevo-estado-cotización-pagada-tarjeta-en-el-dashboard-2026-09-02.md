# Nuevo estado "Cotización pagada" + tarjeta en el Dashboard

## Qué se agrega

1. Un nuevo estado de cotización llamado **Cotización pagada**, disponible en el selector de estados tanto en la lista de cotizaciones como en el formulario de nueva/editar cotización (perfil administrador).
2. El estado se trata como **venta cobrada**: su pago recibido se suma a Ventas del mes, a la analítica mensual/anual, al IVA estimado y a las utilidades, igual que "Pago parcial", "Pedido confirmado" y "Pedido terminado". También descuenta stock igual que esos estados.
3. En el Dashboard se agrega una tarjeta **"Cotizaciones pagadas"** con el número de cotizaciones en ese estado, clickeable hacia el listado de cotizaciones (mismo estilo que las tarjetas actuales).

## Detalle técnico

- Migración: `ALTER TYPE public.quote_status ADD VALUE 'cotizacion_pagada';` (valor nuevo, sin borrar ni alterar registros existentes).
- `src/lib/format.ts`: agregar `cotizacion_pagada: "Cotización pagada"` a `ESTADO_LABEL`.
- `src/lib/admin.functions.ts`:
  - agregar el valor a `ESTADOS_CON_PAGO`, `ESTADOS_INGRESO` y `ESTADOS_INGRESO_ANALYTICS`, y al bloque de meses en `getDashboard`;
  - agregar el valor al `z.enum` de `updateCotizacionEstado` y al de creación/edición de cotización;
  - en `getDashboard` devolver un nuevo campo `cotPagadas` con el conteo de cotizaciones en estado `cotizacion_pagada`.
- `src/routes/_authenticated.admin.cotizaciones.tsx`: agregar el estado al arreglo `estados` (aparece en ambos selectores).
- `src/routes/_authenticated.admin.index.tsx`: nueva tarjeta `Stat` "Cotizaciones pagadas" con `data.cotPagadas`, enlazada a `/admin/cotizaciones`.
- Los datos históricos no se modifican; ninguna cotización cambia de estado automáticamente.

## Verificación

- Typecheck y build.
- Revisar en el preview que el estado aparece en los selectores y que la nueva tarjeta muestra el conteo.
