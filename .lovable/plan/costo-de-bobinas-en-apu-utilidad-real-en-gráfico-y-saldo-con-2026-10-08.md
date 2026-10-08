# Costo de bobinas en APU, utilidad real en gráfico y saldo con IVA

## 1. Compra de bobina = precio costo
- Al registrar una compra de bobina (en Egresos o Boletas), su **costo por m²** (valor / metros útiles) se copia automáticamente como **"Costo material / m²"** del APU de ese color, en el mes de la compra, para todos los productos.
- Si en el mes hay varias bobinas del mismo color, se usa el **promedio ponderado** por metros.
- Mano de obra y otros costos que ya hayas escrito se mantienen.
- En la pantalla APU, el costo material que viene de bobinas se marca "desde bobina"; se puede sobrescribir a mano.
- En el cálculo de utilidad, cada línea vendida usa primero el costo real de la bobina asignada (FIFO); si no tiene, el APU.

## 2. Gráfico de Finanzas con utilidad real
El gráfico de 12 meses pasa a mostrar tres líneas:

```text
Ventas (neto) | Costo de venta (APU/bobinas) | Utilidad real
```

- Utilidad real = Ventas netas − Costo de venta − Gastos operacionales.
- Para no contar dos veces el acero, las compras de bobina **no** se restan como gasto en la utilidad real (su costo entra al consumirse en ventas). La tarjeta "Gastos" sigue mostrando todo lo pagado.
- La tarjeta "Utilidad real (APU)" usa la misma fórmula.

## 3. Saldo de cotizaciones con IVA
- La fila **Saldo** pasa a mostrar **Total con IVA − pagado** en: listado de cotizaciones del panel, formulario de edición, vista web del cliente y PDF.
- Se cambia la etiqueta "Saldo (neto)" por "Saldo (IVA incluido)".

## Detalles técnicos
- Migración: columna `material_desde_bobina boolean default false` en `apu_m2`; función `sync_apu_desde_bobinas(periodo, color_id)` y trigger AFTER INSERT/UPDATE en `bobinas` que hace upsert de `costo_material` (promedio ponderado `valor_total/metros_utiles`) para cada `tipo_producto`, sin pisar filas editadas a mano (`material_desde_bobina = false` con valor > 0).
- `getUtilidadApu` → generalizar a 12 meses (`getUtilidadApuSerie`), usando `bobina_consumos.costo_m2_snapshot` / `bobinas.costo_m2` del item cuando existe; gastos operacionales excluyen egresos/boletas con `bobina_metros > 0`.
- Saldo: helper `saldoConIva(total, pagado) = round(total*1.19) − pagado` en `quotes.core.ts` con test; usado en listado, formulario, `cotizacion.$numero.tsx` y `cotizacion-pdf.ts`. Se actualiza también el `saldo` guardado al crear/editar/pagar.
