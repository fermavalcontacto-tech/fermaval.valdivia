# Descarga de PDF confiable en celular y ajuste móvil

## Situación actual (verificada)

- La cotización ya genera PDF con jsPDF y hay botones "Descargar PDF", "Compartir" e "Imprimir" tanto en la vista pública de la cotización como en el diálogo del panel administrador.
- La descarga usa un enlace con `download` sobre un blob. En escritorio funciona; en Safari/iOS y en algunos WebView de Android ese método suele no hacer nada visible, que es el caso típico de "no me descarga en el celular".
- La página pública en 390 px no tiene desbordamiento horizontal (scrollWidth = clientWidth) y el inicio se ve correcto en móvil; el ajuste móvil pendiente está en las pantallas de cotización (vista pública de la cotización y diálogos del panel).

## Qué se va a hacer

### 1. Entrega de PDF que funcione en cualquier equipo

- Detectar iOS/Safari y navegadores sin soporte real de `download`: en esos casos abrir el PDF en una pestaña nueva desde un `blob:` (o, si el navegador la bloquea, mostrar el PDF en pantalla completa con un botón "Guardar"), para que el usuario use "Compartir → Guardar en Archivos".
- Mantener la descarga directa con `download` cuando sí está soportada (escritorio, Chrome Android).
- Encadenar respaldos en este orden: descarga directa → hoja nativa de compartir (cuando el equipo la ofrece) → pestaña nueva → visor en la propia página.
- Si ningún camino funciona, mostrar un aviso claro con instrucciones en lugar de fallar en silencio.

### 2. Un solo botón principal claro

- En la vista pública de la cotización y en el diálogo del panel: "Descargar PDF" como acción principal, y "Compartir" e "Imprimir" como secundarias.
- En móvil los botones pasan a ancho completo y apilados, con área de toque cómoda.

### 3. Adaptación móvil de las pantallas de cotización

- Revisar y ajustar la vista pública de la cotización (`/cotizacion/<numero>`) a 390 px: tablas de planchas convertidas en tarjetas, totales legibles, sin scroll horizontal.
- Revisar los diálogos del panel administrador en móvil: campos a una columna, resumen Neto/IVA/Bruto apilado, editor de planchas en tarjetas.
- Verificación con navegador en 390 px (móvil), 768 px (tablet) y 1280 px (escritorio), comprobando que no aparezca desbordamiento horizontal.

## Notas técnicas

- Archivos a modificar: `src/lib/cotizacion-pdf.ts` (`deliverPdf`, `sharePdf` y nuevos respaldos), `src/routes/cotizacion.$numero.tsx`, `src/components/admin/PdfPreviewDialog.tsx` y, si hace falta, `src/routes/_authenticated.admin.cotizaciones.tsx` para el layout móvil.
- Sin cambios en base de datos ni en la lógica de precios, IVA, stock o FIFO.
- Al terminar, publicar para que quede disponible en fermaval.com.
