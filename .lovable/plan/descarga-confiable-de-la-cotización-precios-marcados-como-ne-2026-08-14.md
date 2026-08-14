# Descarga confiable de la cotización + precios marcados como "neto"

## 1. Descargable desde celular y computador

Hoy el botón intenta primero la hoja nativa de compartir; si el usuario la cierra o el navegador la rechaza silenciosamente, no queda archivo guardado.

- El botón "Descargar PDF" pasa a **descargar siempre el archivo primero** (enlace con `download`, nombre `Cotizacion-<numero>.pdf`), en celular y en computador.
- Se agrega un botón aparte **"Compartir"** (WhatsApp/Archivos) que usa la hoja nativa solo cuando el usuario lo pide, así nunca reemplaza la descarga.
- Si el navegador bloquea la descarga, se abre el PDF en una pestaña nueva con aviso de "usa Guardar/Compartir" (respaldo actual).
- Se muestra un mensaje de confirmación ("Descargando Cotizacion-XXXX.pdf") y un mensaje claro si falla.
- Puntos donde queda disponible: vista pública de la cotización (`/cotizacion/<numero>`), vista previa del panel administrativo (móvil y escritorio) y justo al crear una cotización nueva (cliente y admin).

## 2. Palabra "neto" junto al valor de la plancha

- En el **PDF**: la columna de precio pasa a "$ / m² neto", cada valor de plancha se muestra como `$X.XXX neto`, y bajo el bloque de totales se agrega la nota "Valores expresados en pesos, netos (sin IVA incluido)".
- En la **vista pública de la cotización**: encabezado "$ / m² neto" en el detalle y "Precio / m² (neto)" en el resumen.
- En el **cotizador público**: encabezado "$ / m² neto" en la tabla de resumen y leyenda "Precios netos, no incluyen IVA".
- En el **panel administrativo**: el campo de precio por línea queda como "Precio / m² neto" y la tarjeta de Configuración como "Precio por tipo de plancha (neto)".

No cambia ningún cálculo: el IVA se sigue mostrando aparte y el total sigue siendo el mismo.

## Detalles técnicos

- `src/lib/cotizacion-pdf.ts`: `deliverPdf` se divide en `downloadBlob` (siempre descarga) y `sharePdf` (opt-in con `navigator.share`); `downloadCotizacionPDF`/`downloadPagoPDF` usan `downloadBlob`. Textos de columna/nota en `buildCotizacionPDF`.
- `src/routes/cotizacion.$numero.tsx`, `src/components/admin/PdfPreviewDialog.tsx`, `src/routes/_authenticated.admin.cotizaciones.tsx`, `src/components/public/CotizadorForm.tsx`, `src/routes/_authenticated.admin.configuracion.tsx`: solo etiquetas y el botón "Compartir".
- Verificación con Playwright en 390 px y 1280 px: al pulsar "Descargar PDF" se captura el evento de descarga con el nombre correcto y sin errores de consola.
- Sin cambios de base de datos.
