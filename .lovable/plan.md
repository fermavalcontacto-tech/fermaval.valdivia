Objetivo: corregir solo el error recurrente “No existe variante de stock para Ondulado · Terracota/Gris · 0.4mm” desde el origen, sin rediseños ni módulos nuevos.

Plan de intervención mínima:

1. Ubicar el origen exacto del mensaje
- Revisar únicamente los archivos donde se calcula/valida la cotización y donde se muestra el toast de error.
- Buscar la cadena “No existe variante de stock” y las llamadas relacionadas con variantes/stock.

2. Corregir la regla de negocio, no ocultar el error
- El sistema ya cambió a stock unificado por color, por lo que la cotización no debe fallar si no existe una variante específica.
- Ajustar la validación para que, al cotizar, use el color como fuente real de stock y cree/obtenga la variante solo como referencia secundaria si hace falta.
- Evitar depender de `producto_variantes.stock_m`, porque esa columna ya no debe controlar disponibilidad.

3. Mantener alcance reducido
- No tocar diseño, dashboard, pagos, correos, Getnet, seguridad ni otros módulos.
- No hacer migraciones salvo que el código revele que falta una función/constraint indispensable para esta corrección.

4. Verificación mínima
- Probar el flujo de “Nueva cotización” con Ondulado + Terracota + 0.4mm.
- Confirmar que ya no aparece el toast rojo y que la cotización puede continuar.

Resultado esperado:
- El formulario permitirá generar cotizaciones aunque no exista previamente una variante exacta de tipo/color/espesor.
- El inventario seguirá descontando desde el stock global por color, según la lógica estructural actual.