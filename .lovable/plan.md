Voy a corregirlo en la fuente más probable: el bundle/app actual todavía puede estar mostrando un error legacy que ya no existe en la base de datos.

Plan:
1. Reforzar el cotizador público para que antes de crear una cotización descarte cualquier toast rojo legacy que diga “No existe variante…” y nunca lo vuelva a renderizar.
2. Cambiar el manejo de error del formulario para que cualquier mensaje relacionado con variantes se traduzca siempre a un mensaje genérico de cotización, aunque venga desde código viejo, caché o backend.
3. Blindar `createPublicQuote` para que no pueda devolver textos legacy de variantes bajo ninguna ruta de error.
4. Revisar la inserción de `cotizacion_items` para asegurar que solo se guarden campos reales del modelo actual: tipo, color, largo, cantidad, m² y espesor; nunca `variante_id`.
5. Verificar en navegador creando cotizaciones con combinaciones como `PV4 + Gris + 0.4 mm` y otra variante distinta, confirmando que el toast rojo legacy ya no aparece.

Hallazgo actual: en la base de datos ya no hay funciones, triggers, políticas ni columnas activas con `variante`, así que el problema apunta a UI/caché/bundle residual, no al esquema activo.