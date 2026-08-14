# Valor por plancha, Neto/Bruto y boletas de bobina enlazadas al stock

## 1. Valor por plancha (solo administrador)

Hoy el diálogo de la captura muestra un único "Precio / m²" global. Se refuerza para que **cada plancha (línea) tenga su propio valor editable**, en crear y editar cotización:

- Campo por línea: "Precio / m² neto" (editable, acepta punto y coma). Si se deja vacío usa el precio del tipo (Configuración) o el precio base.
- Junto a cada línea, tabla compacta:

```text
            Neto        Bruto (IVA 19%)
$ / m²      7.990       9.508
Subtotal    x           x
```

- Ambos valores se recalculan en vivo al cambiar precio, largo o cantidad.
- Se puede escribir el valor en Neto **o** en Bruto: el otro se calcula solo (Bruto = Neto × 1,19).
- Todo este desglose es **solo visible en el panel de administrador**. El cliente sigue viendo únicamente el modo elegido en Configuración (neto o bruto).
- El total de la cotización muestra Neto / IVA 19% / Bruto en el panel.

## 2. Planilla APU cargada al sistema, con varios registros por mes

La planilla es la base de costos por m². Se ajusta el módulo de costos para que **no esté limitado a un registro por mes y tipo**:

- Cada registro de costo pasa a incluir: periodo (mes), tipo de plancha, costo por m², **proveedor** y **bobina asociada (opcional)**, más nota.
- Así pueden coexistir varios costos en el mismo mes, uno por compra/proveedor/bobina.
- Se carga la planilla como registros iniciales del periodo actual (valores de la hoja "PRECIO VENTA FERMAVAL"), editables luego desde Configuración.
- En Configuración: tabla con filtro por mes y proveedor, alta/edición/eliminación, y comparación contra el precio de venta para ver margen $ y % por m².
- El costo usado en cada línea de cotización mantiene la prioridad actual: costo real de la bobina asignada → costo del proveedor/mes → costo genérico del mes.

## 3. Boleta con la palabra "bobina" → stock por proveedor

Al subir una boleta cuya descripción contenga "bobina" (sin distinción de mayúsculas/acentos):

- Se despliegan campos adicionales en el formulario de boleta: **Proveedor (texto libre)**, Color, Metros comprados, Metros defectuosos a simple vista (opcional).
- Al guardar, se crea automáticamente la bobina en inventario con las reglas ya vigentes: 1% de merma + metros defectuosos descontados, metros útiles al stock del color, costo por m² = valor de la boleta / metros útiles.
- El stock queda asociado a ese proveedor y entra a la cola FIFO (se consume primero el más antiguo).
- La boleta queda vinculada a la bobina creada, y la bobina muestra el origen ("Boleta del dd/mm").
- Si la boleta se edita (monto o metros), se recalculan metros útiles y costo por m² de esa bobina.
- El proveedor escrito queda disponible como sugerencia en boletas y egresos posteriores.

## Detalles técnicos

- Migración: agregar `proveedor` y `bobina_id` (nullable) a `costos_m2` y reemplazar la restricción única `(periodo, tipo)` por `(periodo, tipo, proveedor, bobina_id)`; agregar `bobina_id`, `proveedor`, `bobina_color_id`, `bobina_metros`, `bobina_defectuosos` a `boletas`; seed de costos del periodo actual desde la planilla. GRANTs y RLS de admin/staff según el patrón existente.
- `src/lib/domain/quotes.core.ts`: helpers `netoFromBruto`/`brutoFromNeto` ya existen; se agregan `resolveCostoM2` con proveedor y `precioLineaBreakdown` para la tabla Neto/Bruto por línea.
- `src/lib/admin.functions.ts`: `createBoleta`/`updateBoleta` invocan `crear_bobina` / `ajustar_defectuosos_bobina` cuando la descripción incluye "bobina"; nuevas funciones CRUD de `costos_m2` con proveedor.
- UI: `_authenticated.admin.cotizaciones.tsx` (precio y Neto/Bruto por línea), `_authenticated.admin.boletas.tsx` (bloque bobina), `_authenticated.admin.configuracion.tsx` (costos por proveedor/mes), `_authenticated.admin.bobinas.tsx` (origen boleta).
- La vista pública y el PDF del cliente no cambian su modo de precio; el anexo de márgenes sigue siendo opcional e interno.
