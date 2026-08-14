# Alertas clickeables + metros defectuosos de bobina

## 1. Que las alertas del dashboard lleven a su apartado

Hoy cada alerta ("Cotización FV-01056 vencida") es solo texto. Actualmente todas
las alertas del sistema son del tipo `cotizacion_vencida` (13 registros), y la
vista de alertas ya entrega el identificador del registro.

Cambios:
- Cada fila de la tarjeta "Alertas del sistema" pasa a ser un enlace clickeable
  (con cursor de mano y realce al pasar el mouse).
- Según el tipo de alerta se abre el apartado correspondiente:
  - cotización vencida / pago pendiente → Cotizaciones, resaltando y
    desplazándose hasta esa cotización.
  - stock bajo → Bobinas y Proveedores.
  - egreso pendiente → Solicitudes de egreso.
- Para lograr el resalte, la página de Cotizaciones aceptará un parámetro en la
  URL (`?cot=FV-01056`) que filtra el listado por ese número y marca la fila.
- Las cinco tarjetas de resumen (Ventas del mes, Cotizaciones pendientes,
  Pedidos confirmados, Utilidades, Gastos del mes) ya son enlaces; se revisará
  que el área completa de la tarjeta sea clickeable en móvil y escritorio.

## 2. Metros malos "a simple vista" al comprar una bobina

Hoy la bobina solo descuenta el 1% de merma estándar. Se agrega un dato aparte
para los metros que llegan visiblemente defectuosos.

Cambios:
- Nueva columna `metros_defectuosos` en bobinas (por defecto 0).
- En el formulario de **Nueva solicitud de egreso**, dentro del bloque
  "Compra de bobina", se agrega el campo **Metros defectuosos a simple vista
  (opcional)** con teclado decimal, aceptando punto y coma.
- Cálculo: metros útiles = metros comprados − 1% de merma − metros defectuosos.
  La pérdida total (m²) suma la merma más los metros defectuosos, y el costo por
  m² se recalcula sobre los metros realmente útiles.
- El resumen en vivo del formulario mostrará: metros útiles finales, pérdida
  total y costo por m² neto.
- En **Bobinas y Proveedores** se agrega una columna "Defectuosos" y la opción
  de **editar ese valor después** (por si se detectan más metros malos al
  desenrollar). Al editarlo se ajustan metros útiles, saldo disponible (nunca por
  debajo de lo ya consumido), pérdida y costo por m², y queda registro en la
  auditoría.
- El bloque "m² de pérdida por mes" incluirá los metros defectuosos.

## Detalles técnicos

- Migración: `ALTER TABLE public.bobinas ADD COLUMN metros_defectuosos numeric NOT NULL DEFAULT 0`
  y ajuste de la función `crear_bobina` para recibir y aplicar ese valor.
- `src/lib/domain/quotes.core.ts`: `metrosUtiles`/`perdidaBobina`/`costoM2Bobina`
  reciben un parámetro opcional de metros defectuosos.
- `src/lib/admin.functions.ts`: `createEgreso`, `createBobina` y `updateBobina`
  aceptan `metros_defectuosos`; `updateBobina` recalcula útiles, saldo y costo.
- `src/routes/_authenticated.admin.egresos.tsx`: campo nuevo + resumen en vivo.
- `src/routes/_authenticated.admin.bobinas.tsx`: columna y diálogo de edición.
- `src/routes/_authenticated.admin.index.tsx`: alertas como `<Link>` con destino
  por tipo.
- `src/routes/_authenticated.admin.cotizaciones.tsx`: `validateSearch` para
  `?cot=` con filtro y resalte de la fila.
