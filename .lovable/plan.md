## Intervención mínima propuesta

1. **Corregir el flujo que sigue fallando**
   - El toast de la captura viene del módulo de cotizaciones internas/admin, no del cotizador público.
   - Revisaré solo esa ruta y la función server correspondiente para que no consulte ni exija una variante exacta `tipo + color + espesor` al crear o editar cotizaciones.

2. **Eliminar la dependencia real de variantes en creación/edición**
   - Mantener `variante_id: null` en `cotizacion_items`.
   - Asegurar que `createCotizacionManual` y `updateCotizacionFull` usen stock por `color_id` y no fallen por falta de fila en `producto_variantes`.
   - No ocultar el error con un filtro de toast; arreglar el origen.

3. **Limpieza mínima relacionada**
   - Remover o dejar sin uso seguro el helper `fetchOrCreateVariant` si ya no participa en cotizaciones.
   - No tocar pagos, Getnet, diseño, seguridad ni otros módulos.

4. **Verificación local**
   - Validar con búsqueda de código que el flujo de cotizaciones no llame `fetchOrCreateVariant`.
   - Probar/inspeccionar que una línea Ondulado · Terracota · 0.4mm se inserte con `variante_id = null`.
   - Confirmar que no aparezca el toast rojo de variante.