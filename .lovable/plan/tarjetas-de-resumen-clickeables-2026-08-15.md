# Tarjetas de resumen clickeables

## Situación actual (verificada en el código)

- En el **Dashboard** (`/admin`) las 5 tarjetas ya son enlaces: Ventas del mes y Utilidades → Finanzas, Cotizaciones pendientes → Cotizaciones, Pedidos confirmados → Pedidos, Gastos del mes → Egresos.
- La captura muestra la tarjeta con el texto **"Balance neto (Ventas − Gastos)"**, un nombre que ya no existe en el código (hoy dice "Utilidades"). Es decir, la pantalla que estás viendo corresponde a una versión anterior en caché/publicada, no al código actual.
- En **Finanzas** (`/admin/finanzas`) las 4 tarjetas (Ganancias del mes, Balance neto, IVA 19%, Gastos) **no** son clickeables.

## Qué haré

1. Hacer clickeables las 4 tarjetas de Finanzas:
   - Ganancias del mes → listado de ventas/cotizaciones aceptadas
   - Balance neto → detalle de movimientos del mes seleccionado
   - IVA (19%) → mismo detalle de movimientos
   - Gastos → Egresos
2. Añadir a esas tarjetas el mismo comportamiento visual que en el Dashboard: cursor de mano, resaltado al pasar el mouse y foco accesible con teclado.
3. Revisar que no quede ninguna tarjeta de resumen sin destino en Dashboard, Finanzas y Pedidos.
4. Publicar para que fermaval.com sirva la versión actual (allí desaparecerá el rótulo antiguo "Balance neto (Ventas − Gastos)" del dashboard y las tarjetas responderán al click). Recomendable recargar con caché limpia.

## Detalle técnico

- `src/routes/_authenticated.admin.finanzas.tsx`: envolver cada `<Card>` del bloque resumen en `<Link to=...>` de `@tanstack/react-router`, replicando el patrón del componente `Stat` de `src/routes/_authenticated.admin.index.tsx` (clases `hover:border-primary/50 hover:bg-muted/40` + `focus-visible:ring-2`).
- Sin cambios de datos, consultas ni lógica de cálculo; solo presentación y navegación.
