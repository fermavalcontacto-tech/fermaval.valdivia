# Descarga de cotización confiable en celular

Hoy el PDF se genera en el navegador y se entrega con el método propio de la librería, que en móviles (Safari iOS y varios navegadores Android) suele abrir una pestaña en blanco o no descargar nada. Además la vista previa usa un `iframe`, que iOS no renderiza para PDF.

## Qué se va a hacer

1. **Helper único de entrega de PDF** (en la librería de PDF de cotizaciones):
   - Genera el PDF como blob.
   - Si el dispositivo soporta compartir archivos (celulares modernos), abre la hoja nativa de compartir/guardar con el archivo `Cotizacion-XXXX.pdf` (permite "Guardar en Archivos", enviar por WhatsApp, etc.).
   - Si no, usa descarga por enlace con atributo `download`.
   - Último recurso: abre el PDF en una pestaña nueva para que el usuario lo guarde.
   - Nombre de archivo consistente: `Cotizacion-<numero>.pdf` y `Comprobante-Pago-<numero>.pdf`.

2. **Vista previa en móvil (panel admin)**: en pantallas chicas se reemplaza el `iframe` por una tarjeta con resumen y botones grandes "Descargar PDF" / "Compartir por WhatsApp" / "Abrir PDF", en vez de un visor que queda en blanco. En escritorio se mantiene la vista previa actual.

3. **Portal del cliente**: el botón "Descargar PDF" de la cotización pasa a usar el mismo helper, para que funcione igual desde celular.

4. **Al terminar una cotización nueva** (cliente y admin, cualquier perfil): botón visible de descarga/compartir del PDF apenas queda creada, usando el mismo helper.

5. **Verificación**: prueba automatizada en viewport móvil (390px) y escritorio confirmando que al pulsar "Descargar PDF" se produce el archivo con el nombre correcto y sin errores en consola.

## Detalles técnicos

- Nuevo `deliverPdf(doc, filename)` en `src/lib/cotizacion-pdf.ts`: `doc.output("blob")` → `navigator.canShare({ files })` → `<a download>` → `window.open`. `downloadCotizacionPDF` y `downloadPagoPDF` pasan a delegar en él (misma firma, sin cambios en los llamadores).
- `src/components/admin/PdfPreviewDialog.tsx`: usa `useIsMobile()` para elegir entre `iframe` y la vista de botones; libera el blob URL igual que ahora.
- `src/routes/cotizacion.$numero.tsx` y `src/routes/_authenticated.admin.cotizaciones.tsx`: sin cambios de lógica de negocio, sólo el punto de descarga y el botón post-creación.
- Sin cambios de base de datos ni de cálculo de cotizaciones.
