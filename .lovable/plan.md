# Peso del material y nuevo modelo de cotización

## Qué se hace

1. **Peso del material**: cada plancha muestra sus kilos usando 3,66 kg por m², y la cotización muestra el peso total en kg.
2. **Precio por metro lineal real**: cada plancha tendrá su propio precio unitario por metro lineal, editable desde el panel de administración, independiente del precio por m².
3. **Nuevo PDF de cotización** con el formato de la planilla que enviaste.

## Nuevo formato del PDF

Encabezado: logo, "Cotización N° XXXX", datos de FERMAVAL SPA, fecha, y bloque de cliente (Nombre, Giro, RUT, Dirección, Ciudad, Teléfono, Correo, Solicita/Obra).

Franja de vendedor: Vendedor · Teléfono · Correo · Condición de pago · Vencimiento cotización.

Tabla principal:

```text
Cant. | Descripción | Largo de plancha ml | Subtotal ml | Kg | Precio unitario metro lineal | Neto
```

Fila de totales: total cantidad, total ml, total peso kg, y a la derecha Total Neto / IVA (19%) / Total.

Bloques inferiores: "ENTREGA: 24 HORAS SEGÚN ORDEN DE PEDIDOS", medios de pago aceptados, datos de transferencia, la nota legal de retiro de materiales (Decreto 158 MOP) y el cierre "ATTE / EQUIPO FERMAVAL" con teléfono +56 9 3012 6744 y www.fermaval.com.

Se conserva el comprobante de pago y el anexo interno de margen (solo admin), ahora con la columna de kg.

## Datos y lógica

- Constante compartida `PESO_KG_M2 = 3.66` en `src/lib/domain/quotes.core.ts`, con helpers `pesoLinea` (m² × 3,66) y `pesoTotal`.
- Migración aditiva: columna `precio_ml numeric` (nullable) en `public.cotizacion_items` y en `public.cotizaciones`; nada se elimina ni renombra, las cotizaciones históricas siguen intactas.
- Si una línea no tiene `precio_ml`, el PDF lo deriva del precio por m² (ancho 1 m), así los folios antiguos se ven correctos.
- El editor de cotizaciones del admin gana un campo "Precio / ml" por plancha, con desglose neto/bruto y kg de la línea; el total sigue calculándose sobre el precio efectivo de cada plancha.
- La vista web de la cotización (cliente y admin) agrega la columna Kg y el peso total, sin cambiar su diseño actual.

## Archivos afectados

- `src/lib/cotizacion-pdf.ts` — nuevo layout de tabla, columnas Kg y precio por ml, bloques de pago y notas.
- `src/lib/domain/quotes.core.ts` — constante de peso y helpers.
- `src/lib/admin.functions.ts` y `src/lib/public.functions.ts` — persistir `precio_ml` y devolverlo.
- `src/routes/_authenticated.admin.cotizaciones.tsx` — campo de precio por ml y kg en el editor.
- `src/routes/cotizacion.$numero.tsx` — columna Kg y peso total.
- Migración de base de datos para `precio_ml`.

## Verificación

Typecheck, build, y revisión visual del PDF generado (una y varias planchas) en móvil y escritorio.
