# Actualizar teléfono en el encabezado y pie del PDF de cotización

## Qué se corrige

El número de teléfono que aparece en el encabezado y pie del PDF de cotización actualmente muestra el placeholder `+56 9 0000 0000`. La imagen señala exactamente esa línea del PDF. Se cambiará por el número real de contacto de FERMAVAL: `+56 9 3012 6744`.

## Cambio técnico

- En `src/lib/cotizacion-pdf.ts`:
  - Cambiar el campo `telefono` del objeto `EMPRESA` de `"+56 9 0000 0000"` a `"+56 9 3012 6744"`.
  - Se reutilizará la constante ya existente `CONTACTO_FERMAVAL` para evitar duplicidad y mantener un solo punto de verdad.

## Impacto

- El encabezado del PDF (bloque superior derecho) mostrará `Tel: +56 9 3012 6744`.
- El pie del PDF (línea centrada de contacto) mostrará el mismo número.
- La vista previa web (`/cotizacion/$numero`) ya usa `+56 9 3012 6744`, por lo que quedará consistente con el PDF.

## Verificación

- Typecheck del proyecto.
- Generación de una cotización de prueba para confirmar que el PDF renderiza el nuevo número en encabezado y pie.
