# APU por color y producto + Utilidad real del mes en Finanzas

## 1. Nuevo apartado "APU (Análisis de Precio Unitario)"
Nueva sección en el panel (menú: Finanzas → APU) solo para administradores:

- Selector de mes.
- Tabla editable: una fila por **Producto (tipo de plancha) × Color**, con:
  - Costo material por m² (acero/bobina)
  - Mano de obra por m²
  - Otros costos por m² (energía, transporte, insumos)
  - **Costo APU total / m²** (suma automática, neto)
- Botón "Copiar APU del mes anterior" para no reingresar todo cada mes.
- Si un producto/color no tiene APU cargado, se usa el costo genérico del tipo (el que ya existe en Configuración) y se marca "sin APU".
- Acepta punto y coma como decimal.

## 2. Finanzas: tarjetas renombradas y utilidad real
Las tarjetas del mes seleccionado quedan:

```text
Ventas del mes | Utilidad real (APU) | Balance neto | IVA 19% | Gastos
```

- **Ventas del mes**: lo que hoy dice "Ganancia del mes" (mismo cálculo).
- **Utilidad real (APU)**: por cada cotización vendida del mes, por cada línea:
  `(precio neto por m² − costo APU del producto/color del mes) × m²`. Se suma todo.
  Muestra también el margen % sobre ventas netas.
- **Balance neto**: Ventas − Gastos (como hoy).
- IVA y Gastos sin cambios.
- Debajo, un cuadro "Detalle utilidad por producto y color": m² vendidos, venta neta, costo APU, utilidad y %, ordenado de mayor a menor. Las líneas sin APU aparecen avisadas.

## Detalles técnicos
- Migración: tabla `public.apu_m2` (periodo date, tipo tipo_producto, color_id uuid, costo_material, mano_obra, otros_costos numeric default 0, nota, created_by, timestamps), único `(periodo, tipo, color_id)`, GRANTs a authenticated/service_role, RLS solo admin (`has_role`), triggers touch + audit.
- `admin.functions.ts`: `listApu`, `upsertApu`, `copiarApuMesAnterior`, `deleteApu`; `getDashboard` agrega por mes `utilidadApu` y `detalleApu` consultando `cotizacion_items` de cotizaciones en estados de ingreso, resolviendo costo: APU tipo+color del mes → `costos_m2` del tipo → 0.
- `quotes.core.ts`: helper puro `utilidadLineaApu` con prueba unitaria.
- Nueva ruta `_authenticated.admin.apu.tsx` y ajustes en `_authenticated.admin.finanzas.tsx`.
