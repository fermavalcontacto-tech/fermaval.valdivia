## 1. Eliminar el botón de pago Getnet (frontend)

- `src/routes/cotizacion.$numero.tsx`: remover el bloque del botón "Pagar con Getnet", el badge "Pagado" que dependía de la sesión Getnet, el polling de retorno y los imports asociados. Mantener el badge de "Pagado" cuando `saldo === 0` (basado en la cotización, no en Getnet).
- `src/routes/_authenticated.admin.pagos-getnet.tsx`: eliminar el archivo.
- `src/routes/_authenticated.tsx`: quitar el enlace "Pagos Getnet" del sidebar admin.
- No se toca `getnet_sessions`, `create-getnet-payment`, `webhook-getnet`, `query-getnet-payment` ni `getnet.server.ts` — quedan como backend inactivo para reactivar más adelante sin migración.

## 2. Aceptar coma decimal en el largo (m)

- `src/components/public/CotizadorForm.tsx` (cotizador público) y `src/routes/_authenticated.admin.cotizaciones.tsx` (edición admin, mismo input de largo):
  - Cambiar el input de largo de `type="number"` a `type="text" inputMode="decimal"` con `pattern="[0-9]*[.,]?[0-9]*"`.
  - Normalizar en el `onChange`: aceptar sólo dígitos y un único separador; guardar el string tal cual escribe el usuario.
  - Antes de calcular m² o enviar al backend, convertir con `Number(str.replace(",", "."))`. Sin cambios en cantidad (sigue entero) ni en descuentos/precios.
- `src/lib/domain/quotes.core.ts`: en `ItemInputSchema`, aceptar `largo_m` como string o number; si es string, normalizar la coma antes de parsear con Zod. Así admin y cliente comparten la misma sanitización.

## 3. Nueva sección "Venta de chatarra" en Finanzas

### Base de datos (migración)

Nueva tabla `public.ventas_chatarra`:
- `id uuid pk default gen_random_uuid()`
- `fecha date not null default current_date`
- `monto numeric(12,0) not null check (monto >= 0)`
- `descripcion text`
- `created_by uuid references auth.users`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`

Con `GRANT` a `authenticated` y `service_role` (sin anon), RLS activada y políticas:
- SELECT / INSERT / UPDATE / DELETE sólo para `is_staff(auth.uid())`.
Trigger `touch_updated_at` para `updated_at` y trigger `trg_audit_row` para auditar (consistente con las otras tablas críticas).

### Backend

En `src/lib/admin.functions.ts`:
- `listVentasChatarra({ desde?, hasta? })` — lista con filtro opcional.
- `upsertVentaChatarra({ id?, fecha, monto, descripcion? })` — Zod: monto entero ≥ 0, descripcion máx 500.
- `deleteVentaChatarra({ id })`.
- `getDashboard()` — sumar `ventas_chatarra.monto` del mes al campo `ventas` de cada mes devuelto, para que "Ganancias del mes" y "Balance neto" ya incluyan la chatarra sin duplicar lógica en la UI.

### UI

En `src/routes/_authenticated.admin.finanzas.tsx`, agregar debajo de "Movimientos históricos" una nueva Card **"Venta de chatarra"**:
- Formulario compacto: fecha (default hoy), monto (CLP), descripción.
- Tabla de las últimas ventas (fecha, monto, descripción, botón eliminar).
- Botón guardar dispara `upsertVentaChatarra`, invalida `["dashboard"]` y `["ventas_chatarra"]`.
- Toast de éxito/error.

## Fuera de alcance

- No se toca el flujo de cotizaciones, pedidos, pagos manuales, stock, ni el diseño global.
- No se elimina la infraestructura backend de Getnet (endpoints, tabla, secretos) para no bloquear una futura reactivación.
- No se cambian los inputs numéricos distintos al largo (cantidad, descuentos, precios).

## Archivos afectados

- Eliminar: `src/routes/_authenticated.admin.pagos-getnet.tsx`.
- Editar: `src/routes/cotizacion.$numero.tsx`, `src/routes/_authenticated.tsx`, `src/components/public/CotizadorForm.tsx`, `src/routes/_authenticated.admin.cotizaciones.tsx`, `src/lib/domain/quotes.core.ts`, `src/lib/admin.functions.ts`, `src/routes/_authenticated.admin.finanzas.tsx`.
- Migración: `create table public.ventas_chatarra` + grants + RLS + policies + triggers.
