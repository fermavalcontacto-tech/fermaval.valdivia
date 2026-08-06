# RUT del cliente + contacto y web al cierre de cada cotización

## Qué se agrega

1. **Campo RUT (opcional)** en el formulario de cotización, tanto en el Portal del Cliente como en el Panel Administrativo.
   - Se guarda sin puntos y con guión: `12345678-9`.
   - Se normaliza automáticamente al escribir: se quitan puntos y espacios, y se inserta el guión antes del dígito verificador.
   - Si queda vacío, la cotización se genera igual (igual que correo, teléfono y dirección).
   - Si se escribe algo inválido, mensaje en español: "RUT inválido (ej: 12345678-9)".

2. **RUT visible en la cotización**: aparece en el bloque de datos del cliente en la vista previa web y en el PDF. Si no se informó, se muestra "No informado".

3. **Cierre de cada cotización** (vista previa y PDF, cliente y admin):
   ```text
   ¿Tienes dudas o deseas confirmar tu pedido?
   +56 9 3012 6744
   www.fermaval.com
   ```

## Detalles técnicos

- Migración: agregar `rut text` (nullable) a `public.clientes`. Sin borrar datos; los clientes existentes quedan con RUT vacío.
- `src/lib/domain/quotes.core.ts`: helpers compartidos `sanitizeRut`, `formatRut`, `isValidRut` (validación de módulo 11) y etiqueta "RUT" en `FIELD_LABELS`.
- Zod: `rut` opcional con `.default("")` en `createPublicQuote` (`src/lib/public.functions.ts`) y en las mutaciones de cotizaciones de `src/lib/admin.functions.ts`; se guarda normalizado.
- UI: input RUT con `inputMode="text"` y `maxLength` en `src/components/public/CotizadorForm.tsx` y `src/routes/_authenticated.admin.cotizaciones.tsx`.
- PDF: mostrar RUT en la tabla de datos del cliente y añadir la línea `www.fermaval.com` en `drawContactBlock` de `src/lib/cotizacion-pdf.ts`.
- Vista previa: añadir RUT y el enlace a www.fermaval.com en `src/routes/cotizacion.$numero.tsx`.
- Tipos de Supabase regenerados; verificación con typecheck y una prueba de humo del cotizador (con y sin RUT).
