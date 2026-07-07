# Refactor Fermaval — Portal Cliente + Panel Admin unificados

Refactor grande, con impacto en base de datos, server functions y UI. Lo divido en fases para poder validar en cada paso sin romper lo que ya funciona (pagos, Getnet, cotizaciones existentes, PDFs).

Antes de tocar código pido confirmación del plan completo. No borro nada, no toco pagos/Getnet, no cambio diseño salvo lo mínimo del portal cliente.

---

## Fase 0 — Diagnóstico y respaldo (sin cambios)

1. Snapshot de tablas clave: `cotizaciones`, `cotizacion_items`, `pagos`, `producto_variantes`, `colores`, `clientes`, `user_roles`, `stock_movimientos`.
2. Inventario de variantes faltantes (combinaciones tipo × color × espesor que aparecen en `cotizacion_items` sin `variante_id`).
3. Lista de rutas admin/cliente y funciones server que hoy tocan cada tabla, para saber qué unificar.

**Entrega:** informe corto en `.lovable/refactor-report.md`.

---

## Fase 1 — Modelo de datos unificado (migración única, aditiva)

Sin eliminar columnas ni datos. Todo con `IF NOT EXISTS` / `ADD COLUMN`.

1. **Catálogos** (si no existen ya):
   - `tipos_producto(id, nombre UNIQUE, activo, orden)`
   - `espesores(id, valor_mm UNIQUE, activo)`
   - Migrar los enums/strings actuales a estas tablas manteniendo el enum como fallback.
2. **`producto_variantes`**:
   - Índice `UNIQUE (tipo, color_id, espesor_mm)` (ya existe según `fetch_or_create_variant`, confirmo).
   - Campos: `stock_m`, `stock_minimo_m`, `activo`, `updated_at`.
3. **`cotizacion_items.variante_id`**: mantener nullable (ya lo es tras el último fix). Se rellenará por trigger cuando la variante exista o se cree.
4. **`pedidos` + `pedido_items`**: si no existen como tablas separadas, crearlas derivadas de `cotizaciones` con `estado in ('pedido_confirmado','pedido_terminado')`. Si el modelo actual ya usa `cotizaciones` como pedido (parece que sí por `estado`), NO duplico: dejo `cotizaciones` como fuente y documento la convención.
5. **`stock_movimientos`**: FK obligatoria a `variante_id`, tipo (`ingreso`, `egreso`, `ajuste`, `venta`), referencia a `cotizacion_id` opcional.
6. **`auditoria`**: tabla nueva `audit_log(id, user_id, rol, accion, tabla, registro_id, payload jsonb, created_at)`.
7. **Función `ensure_variant(tipo, color_id, espesor)`**: devuelve `variante_id`, creándola con stock 0 si no existe. Reemplaza el uso de `fetch_or_create_variant` desde código.
8. **Trigger `trg_auto_variants`** en `colores`, `tipos_producto`, `espesores`: al insertar uno nuevo, crea el producto cartesiano faltante en `producto_variantes` con stock 0.
9. **Trigger `trg_cotizacion_item_variant`**: antes de insertar en `cotizacion_items`, si `variante_id` es NULL y hay tipo+color+espesor, llama `ensure_variant` y lo rellena.
10. **Trigger `trg_stock_on_pedido_confirmado`**: cuando `cotizaciones.estado` pasa a `pedido_confirmado`, genera `stock_movimientos` tipo `venta` por cada item y descuenta `stock_m`.
11. **GRANTs y RLS** revisados por tabla nueva.

**Migración de datos:** un job SQL único que recorre `cotizacion_items` con `variante_id IS NULL` y llama `ensure_variant`. No borra, no modifica montos, no toca `cotizaciones`.

---

## Fase 2 — Capa de lógica única (`src/lib/domain/`)

Reorganizar server functions para que cliente y admin llamen la MISMA función núcleo, cambiando solo el middleware/permiso.

```
src/lib/domain/
  quotes.core.ts        // cálculo m², totales, validación líneas
  quotes.functions.ts   // createQuote, updateQuote, acceptQuote  (server fn)
  orders.functions.ts   // confirmOrder, cancelOrder
  payments.functions.ts // registerPayment
  stock.functions.ts    // adjustStock, listVariants
  catalog.functions.ts  // colores/tipos/espesores CRUD (admin only)
  pdf.ts                // plantilla única cotización/pedido
  email.ts              // eventos centralizados
```

Reglas:
- Todas las funciones que crean/editan cotizaciones usan `ensure_variant` vía RPC — nunca fallan por "variante inexistente".
- Diferencia cliente vs admin = middleware:
  - Cliente público: sin auth, sólo `createQuote` y lectura por `access_token`.
  - Cliente logeado (futuro/opcional): historial propio por `cliente_id` ligado a `auth.uid`.
  - Admin: `requireSupabaseAuth` + `has_role('admin')`.
- Se eliminan `src/lib/admin.functions.ts` y `src/lib/public.functions.ts` como copias paralelas; quedan como re-exports finos hacia `domain/` para no romper imports actuales.

---

## Fase 3 — Portal Cliente

Rutas nuevas / consolidadas:
- `/` cotizador (ya existe, sólo pasa a usar `domain/quotes`).
- `/cotizacion/$numero` (existe) — añade tabs: Detalle · Pagos · Estado.
- `/mis-cotizaciones` — lista por correo + token o por sesión de cliente si se implementa login cliente.
- Descarga automática de PDF al confirmar cotización.

Sin rediseño visual: reutilizo componentes existentes.

---

## Fase 4 — Panel Admin

- `/_authenticated/admin/cotizaciones` migra a `domain/quotes` (crear, editar, aprobar, convertir a pedido).
- `/_authenticated/admin/variantes` muestra la matriz completa auto-generada, permite editar stock/mínimo, nunca "crear variante" manual.
- `/_authenticated/admin/colores|tipos|espesores` dispara auto-creación de variantes por trigger.
- Reportes y finanzas: consultas contra las mismas vistas que ve el cliente.

---

## Fase 5 — Auditoría, alertas, correos

- Middleware `withAudit(accion, tabla)` para envolver server fns de escritura.
- Vista `v_alertas` (stock bajo, cotizaciones vencidas >72h sin aceptar, pagos pendientes).
- Servicio `email.ts` con eventos: `quote.created`, `quote.accepted`, `order.confirmed`, `payment.received`, `stock.low`. Reutiliza `gmail.server.ts`.

---

## Fase 6 — Responsive y QA

- Revisión componentes con Playwright viewport iPhone/Android/Tablet/Desktop.
- Suite mínima: crear cotización cliente, aprobar en admin, registrar pago, verificar stock descontado, PDF generado.

---

## Lo que NO se toca

- Pagos Getnet (`src/routes/api/public/*getnet*`).
- Diseño visual salvo tabs nuevas en portal cliente.
- Secretos, auth flow, dominios.
- Historial existente: 0 DELETE, 0 UPDATE destructivo.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Triggers de stock descuentan doble al reprocesar | Idempotencia por `stock_movimientos.cotizacion_id + variante_id` UNIQUE |
| Migración de items sin variante falla | Se corre en transacción y en batch; log de errores por item |
| Rutas admin actuales rompen por refactor | Re-exports de compat en `admin.functions.ts` / `public.functions.ts` durante 1 versión |
| Volumen de variantes (tipos×colores×espesores) grande | Índice compuesto + paginación en UI admin |

---

## Entregables por fase

1. Fase 0: reporte.
2. Fase 1: 1 migración SQL grande + regeneración de types.
3. Fase 2: refactor de server fns, sin cambios de UI.
4. Fase 3: portal cliente actualizado.
5. Fase 4: admin actualizado.
6. Fase 5: auditoría/alertas/correos.
7. Fase 6: QA responsive.

---

## Pregunta antes de empezar

¿Avanzo Fase 0 + Fase 1 en el próximo turno (diagnóstico + migración única de esquema, sin tocar UI todavía), o prefieres que arranque directo por Fase 2 asumiendo el esquema actual y dejando la migración de variantes como paso posterior?
