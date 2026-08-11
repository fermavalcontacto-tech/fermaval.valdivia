# Impresión de cotizaciones y precio por tipo de plancha

Dos mejoras en el módulo de Cotizaciones, iguales para el Portal del Cliente y el Panel Administrativo.

## 1. Imprimir la cotización

- Botón **Imprimir** junto a "Descargar PDF" en:
  - la vista previa del panel administrativo (escritorio y celular),
  - la página de la cotización del cliente (`/cotizacion/<numero>`).
- Al pulsarlo se abre el diálogo de impresión del sistema con el mismo PDF que se descarga (mismo diseño, no una versión distinta de la pantalla).
- En celulares, si el navegador no permite imprimir directamente, se abre el PDF para que el usuario use "Imprimir" o "Compartir" del sistema.

## 2. Precio por m² para cada tipo de plancha

- Cada tipo (Ondulado, PV8, PV8 Invertido, Microondulado, 6V, PV4, Lata Lisa) tiene su propio **precio por m²**, guardado en la base de datos.
- **Configuración (admin)**: nueva sección "Precios por tipo de plancha" con un campo por tipo. Ahí se define el precio base que usarán las próximas cotizaciones. El precio general actual se conserva como respaldo para tipos sin precio propio y para no alterar cotizaciones antiguas.
- **Cotizador del cliente**: al elegir el tipo de cada plancha, el precio y el total se calculan con el precio de ese tipo. Cada línea muestra su precio por m² y su subtotal.
- **Cotización desde el admin (crear y editar)**: cada línea trae el precio del tipo cargado automáticamente y se puede **cambiar a mano solo para esa cotización**, sin afectar el precio base. El total se recalcula al instante.
- **Totales**: total = suma de (m² de la línea × precio por m² de la línea) − descuento.
- **PDF y vista previa**: la tabla muestra el precio por m² real de cada línea y su subtotal; si todas comparten el mismo precio se sigue viendo igual que hoy.
- **Cotizaciones históricas**: se mantienen intactas; conservan el precio con el que fueron creadas.

## Detalles técnicos

- Migración:
  - `public.precios_tipo` (`tipo` tipo_producto único, `precio_m2` numeric, timestamps) con GRANT a `authenticated`/`service_role`, RLS: lectura para staff, escritura solo admin, más trigger de auditoría y `touch_updated_at`. INSERT inicial con los 7 tipos usando el `precio_m2` actual de `configuracion_web`.
  - `cotizacion_items.precio_m2 numeric` (nullable) y backfill con el `precio_m2` de la cotización padre. `cotizaciones.precio_m2` se mantiene (promedio/precio principal) para compatibilidad.
- Lectura pública de precios vía `getPublicConfig` en `src/lib/public.functions.ts` (sin exponer stock), y en el cálculo compartido de `src/lib/domain/quotes.core.ts`: `buildItemsCalc` pasa a resolver `precio_m2` por línea (precio explícito de la línea > precio del tipo > precio general) y `calcTotal` suma subtotales por línea.
- `src/lib/admin.functions.ts`: `createCotizacionManual` y `updateCotizacionFull` aceptan `precio_m2` por ítem; nuevas funciones `listPreciosTipo` / `updatePreciosTipo` (admin) para Configuración.
- UI: campo de precio por línea en `_authenticated.admin.cotizaciones.tsx` (crear y editar) con `DECIMAL_INPUT_PROPS`; sección de precios en `_authenticated.admin.configuracion.tsx`; `CotizadorForm.tsx` muestra precio y subtotal por línea.
- Impresión: nuevo `printPdf(doc)` en `src/lib/cotizacion-pdf.ts` (blob URL → iframe oculto → `print()`, con respaldo de abrir en pestaña nueva); usado por `PdfPreviewDialog.tsx` y `cotizacion.$numero.tsx`.
- `src/lib/cotizacion-pdf.ts`: la tabla usa `item.precio_m2` cuando existe, con respaldo al precio de la cotización.
- Verificación con Playwright en 390px y 1280px: crear cotización con dos tipos de distinto precio y confirmar totales, descarga e impresión sin errores en consola.
