# Numeración correlativa de cotizaciones

Hoy las cotizaciones del panel administrativo usan un número basado en la hora (`FV-` + últimos dígitos del timestamp), mientras que las del portal público usan un contador real de la base de datos. Por eso los folios no quedan en secuencia.

## Qué se hará

1. Usar un único contador de base de datos para todas las cotizaciones (admin y cliente): folios tipo `FV-00001`, `FV-00002`, `FV-00003`…
2. Ajustar el contador para que continúe desde el folio más alto ya existente, sin tocar ni renumerar cotizaciones históricas.
3. Eliminar el respaldo basado en timestamp: si el contador falla, se reintenta y se muestra un error claro en vez de generar un folio fuera de secuencia.
4. Garantizar que dos cotizaciones creadas al mismo tiempo nunca reciban el mismo folio.

## Detalles técnicos

- Migración: actualizar `public.cotizacion_numero_seq` con `setval` al máximo valor numérico detectado en `cotizaciones.numero` (patrón `FV-<dígitos>`), de forma que el siguiente valor sea mayor a todos los folios actuales.
- Helper compartido `nextQuoteNumber(client)` que llama al RPC `nextval_quote` y formatea `FV-` + `padStart(5, "0")`.
- `src/lib/admin.functions.ts` (~línea 250): reemplazar `"FV-" + Date.now()...` por el helper.
- `src/lib/public.functions.ts` (~líneas 73-76): usar el helper y quitar el fallback de timestamp; propagar error si el RPC falla.
- Si al insertar aparece un conflicto de unicidad en `numero`, tomar el siguiente valor del contador y reintentar (máx. 3 intentos).
- No se modifican folios existentes; los históricos con formato antiguo se mantienen tal cual.
