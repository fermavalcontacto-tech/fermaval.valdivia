## Alinear tipos de plancha con la imagen y publicar

### 1. Reemplazar la lista de tipos

En `src/lib/domain/quotes.core.ts`, reemplazar `TIPOS_PRODUCTO` por el listado exacto de la imagen (en este orden):

```
Ondulado
PV8
PV8 Invertido
Microondulado
6V
PV4
Lata Lisa
```

Esto se propaga automáticamente al `<select>` del cotizador (`CotizadorForm.tsx`) y al enum de validación Zod (`TipoEnum`), sin cambios adicionales.

### 2. Compatibilidad con cotizaciones históricas

Las cotizaciones antiguas guardadas con `tipo` en {Trapezoidal, Minionda, PV6, Teja Continua, Teja Colonial, Teja Española} seguirán mostrándose tal cual en el admin (son solo texto en `cotizacion_items.tipo`). No se migran ni se borran; solo dejan de ofrecerse al crear nuevas.

- Ajustar el comentario del bloque `TIPOS_PRODUCTO` para reflejar la lista vigente.
- Si el schema Zod rechaza los tipos históricos al releer, relajar `TipoEnum` para lectura (aceptar string en items ya guardados) manteniendo el enum estricto solo en el input público. Verificaré esto tras el cambio.

### 3. Verificación

- Recorrer con Playwright el cotizador con los 7 tipos nuevos × 3 colores y confirmar que:
  - El `<select>` muestra exactamente los 7 tipos de la imagen.
  - Se genera cotización sin toast rojo.
- Revisar `/admin/cotizaciones` para asegurar que cotizaciones antiguas con tipos legacy siguen renderizando.

### 4. Publicar a producción

- Correr `security--get_scan_results` para descartar hallazgos críticos pendientes.
- Publicar con `preview_ui--publish`. La actualización se propaga a `fermaval.lovable.app` y al dominio custom `fermaval.com` / `www.fermaval.com` automáticamente (mismo deploy).

### Detalles técnicos

- Único archivo de código a editar: `src/lib/domain/quotes.core.ts` (constante `TIPOS_PRODUCTO`). Posiblemente un mínimo ajuste al schema si el enum estricto rompe cotizaciones legacy al releer.
- No se toca la base de datos, ni migraciones, ni RLS.
