# Boleta con "bobina": hacer visible el bloque de stock

## Qué pasa

Los campos de bobina (proveedor, color, metros, metros defectuosos, con cálculo de metros útiles / pérdida 1% / costo por m²) ya están implementados en el formulario "Subir boleta o comprobante".

La captura enviada corresponde a una versión anterior de la app: en ella el campo Descripción no muestra el texto de ayuda nuevo ("Escribe *bobina* para enlazar la compra al stock") que sí está en el código actual. Es decir, la pantalla vista es el sitio publicado (fermaval.com) o una pestaña con caché antigua, no el código vigente.

## Plan

1. Verificar en la vista previa, con navegador automatizado, que al escribir "Bobina" en Descripción aparece el bloque de compra de bobina y que los cálculos en vivo responden (metros útiles, pérdida, costo por m² neto). Adjuntar evidencia.
2. Publicar a producción para que fermaval.com quede con la misma versión, e indicar al usuario recargar con caché limpia.
3. Mejoras pequeñas para que sea imposible "no verlo":
   - Mover el bloque de bobina justo debajo de Descripción y agregar un título visible "Compra de bobina — se suma al stock".
   - Agregar además un interruptor manual "Esta boleta es una compra de bobina", de modo que el bloque se pueda activar aunque la descripción se escriba distinto (por ejemplo "rollo" o "bobinas").
4. Extender el diálogo "Editar boleta" con los mismos campos, para corregir una boleta ya cargada sin perder el enlace al stock.

## Detalles técnicos

- Archivo: `src/routes/_authenticated.admin.boletas.tsx` (componentes `NuevaBoleta`, `EditarBoletaDialog`, `BobinaFields`).
- El backend ya acepta `proveedor`, `bobina_color_id`, `bobina_metros`, `bobina_defectuosos` en `createBoleta` y `updateBoleta` (`src/lib/admin.functions.ts`), y el disparador `trg_boleta_bobina` crea/actualiza la bobina en stock (FIFO, 99% útil menos defectuosos).
- No hay cambios de base de datos en este plan.
