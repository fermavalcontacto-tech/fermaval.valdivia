# Quitar la alerta roja y aceptar punto y coma en cotizaciones

## Situación actual (verificada en el código)

- Los campos de contacto (teléfono, correo, dirección) ya son **opcionales** en el código actual: las validaciones del servidor en `src/lib/admin.functions.ts` y `src/lib/public.functions.ts` usan `.optional().default("")`, sin mínimo de 3 caracteres.
- Los campos decimales (largo, precio/m², descuento, pago recibido, stock en metros) ya usan la lógica compartida que acepta punto y coma.
- El error rojo de la captura (`too_small ... minimum: 3` para telefono/correo/direccion) corresponde a **la versión publicada en fermaval.com**, que aún ejecuta el código anterior. En el preview actual ese error ya no puede ocurrir.

## Qué se hará

1. **Publicar a producción** para que fermaval.com y www.fermaval.com queden con la versión que ya tiene los campos opcionales y el soporte de coma decimal.
2. **Mensajes de error legibles**: hoy, si una validación falla, se muestra el JSON crudo de la validación en rojo. Se agregará una traducción de errores a un mensaje corto en español (por ejemplo "Correo inválido") tanto en el guardado de cotizaciones del Panel Administrativo como en el Portal del Cliente, para que nunca vuelva a aparecer un bloque rojo con texto técnico.
3. **Repaso final de decimales**: confirmar que en el diálogo de cotización del admin y en el cotizador público se pueda escribir `3,5` y `3.5` con el mismo resultado, en móvil y escritorio.

## Detalle técnico

- Añadir un helper `friendlyValidationMessage()` en `src/lib/domain/quotes.core.ts` que detecte errores de Zod (`ZodError` o cadena JSON con `code`/`path`) y devuelva un texto en español por campo, con fallback genérico.
- Usarlo en los `onError` de las mutaciones de `src/routes/_authenticated.admin.cotizaciones.tsx` y en `publicQuoteErrorMessage` para el Portal del Cliente.
- Sin cambios de base de datos ni pérdida de datos históricos.
