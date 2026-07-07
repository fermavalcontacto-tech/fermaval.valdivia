## Verificación exhaustiva para TODAS las variantes

El blindaje ya está aplicado a nivel global (regex + interceptor de `toast.error` + MutationObserver), así que aplica a cualquier combinación tipo+color+espesor. Falta confirmarlo empíricamente.

### Plan

1. Recorrer con Playwright el cotizador probando una matriz representativa de variantes:
   - PV4 × {Gris, Rojo, Verde, Blanco} × {0.35, 0.4, 0.5 mm}
   - PV5 × mismos colores × mismos espesores
   - PV6 (o el resto de tipos disponibles) × mismos colores × mismos espesores
2. Para cada combinación: ingresar largo y cantidad, generar cotización, capturar screenshot y volcar `document.querySelectorAll('[data-sonner-toast]')` para verificar que no aparece ningún toast rojo con texto tipo "No existe variante".
3. Registrar cualquier combinación que aún dispare el toast rojo, con el mensaje exacto y el stack del error en consola/red.
4. Si alguna combinación falla:
   - Ampliar `LEGACY_VARIANT_ERROR_PATTERN` en `quotes.core.ts`, `public.functions.ts` y `sonner.tsx` para cubrir el nuevo texto.
   - Revisar si viene de Postgres (constraint/trigger residual) o de código cliente y eliminar la fuente.
5. Repetir hasta que la matriz completa pase limpia.

### Detalles técnicos

- La detección hoy cubre: `no existe variante`, `variante de stock`, `producto_variantes`, `variante_id`, `ensure_variant`, `fetch_or_create_variant`, `stock para`. Si aparece otro texto se agrega al regex en los 3 archivos a la vez.
- No se tocará lógica de negocio (cálculo m²/total) ni validaciones legítimas de stock actuales; solo se silencian/traducen mensajes legacy de variantes.
- Entregable: tabla de resultados por combinación + screenshots + parche (si hace falta).
