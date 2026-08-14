# Cotizador: neto/bruto, precio visible y % de ganancia por m²

## 1. Tarjetas del dashboard como botones

Las 5 tarjetas del resumen del mes pasan a ser enlaces:

- Ventas del mes → Finanzas
- Cotizaciones pendientes → Cotizaciones
- Pedidos confirmados → Pedidos
- Utilidades (Ventas − Gastos) → Finanzas
- Gastos del mes → Egresos

Mismo diseño, con efecto de hover y cursor de mano para que se note que son clicables.

## 2. Neto y bruto del precio por m² (solo administrador)

En cada línea de plancha del cotizador administrativo (crear y editar) se muestra el precio por m² en dos columnas:

```text
Precio por m²      Neto        Bruto (c/IVA 19%)
                   $6.714      $7.990
```

El valor se recalcula al cambiar el precio de esa plancha. También se podrá escribir el precio en bruto y el sistema deduce el neto (y al revés), para no tener que calcular a mano. Nada de esto se muestra al cliente.

## 3. El administrador elige qué precio ve el cliente

Nueva opción en Configuración: "Precio que ve el cliente" → Neto o Bruto (con IVA). Es un ajuste global que aplica a:

- la vista pública de la cotización,
- el PDF descargable/imprimible,
- el cotizador público.

Se muestra siempre la etiqueta correspondiente ("neto" o "IVA incluido") para que no haya confusión.

## 4. Planilla APU como referencia + % de ganancia por m²

- La planilla `PLANILLA_APU_PARA_BAYRON.xlsx` queda disponible para descarga desde el panel (sección Configuración → "Referencia de costos APU"), tal cual como la subiste.
- Junto a ella, una tabla editable de **costo por m² (neto)** por tipo de plancha, precargada con los valores de la planilla (costo directo por ml ≈ $6.594 para 0,4 mm prepintado, ajustable por tipo) y con historial mensual, igual que la utilidad por m².
- Con ese costo, cada cotización del panel muestra:
  - por línea: ganancia por m² ($ y %),
  - total: ganancia total y % de margen promedio.
- En el dashboard se agrega una tarjeta "Margen promedio del mes (%)" calculada con las ventas del mes y el costo por m² vigente.

Fórmula usada: `% ganancia = (precio neto m² − costo neto m²) / precio neto m²`.

## Detalles técnicos

- Migración: tabla `public.costos_m2` (periodo, tipo, costo_m2, nota) con RLS para staff, trigger de auditoría y `updated_at`; columna `precio_cliente_modo` ('neto' | 'bruto') en `configuracion_web`.
- `src/lib/domain/quotes.core.ts`: helpers `netoFromBruto`, `brutoFromNeto`, `margenM2`, y resolución del modo de precio visible.
- `src/lib/admin.functions.ts`: `listCostosM2`, `upsertCostoM2`, y el modo de precio en la lectura/escritura de configuración.
- `src/lib/public.functions.ts` y `src/lib/cotizacion-pdf.ts`: aplican el modo de precio elegido.
- Planilla servida vía Lovable Assets (no se copia el binario al repo).
- Rutas tocadas: `_authenticated.admin.index.tsx`, `_authenticated.admin.cotizaciones.tsx`, `_authenticated.admin.configuracion.tsx`, `cotizacion.$numero.tsx`, `components/public/CotizadorForm.tsx`.
