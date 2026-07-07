**Diagnóstico**
- El mensaje rojo viene de una ruta antigua de “variantes de stock”.
- En la base de datos actual no encontré triggers, tablas ni funciones activas que todavía lancen ese texto.
- En el código actual tampoco aparece ese mensaje como error activo; por eso lo más probable es una de estas dos causas:
  - el navegador/preview está ejecutando un bundle anterior en caché, o
  - alguna función del servidor quedó desplegada con lógica antigua y todavía puede devolver el error.

**Plan de solución de raíz**
1. Reforzar el cotizador público para que nunca muestre errores heredados de variantes, aunque vengan desde una función/bundle viejo.
2. Blindar `createPublicQuote` para que cualquier error residual relacionado con variantes se transforme en un error genérico o se evite antes de llegar al usuario.
3. Revisar y corregir las funciones de cotización/admin que guardan `cotizacion_items`, asegurando que inserten solo campos reales: tipo, color, largo, cantidad, m² y espesor fijo.
4. Crear una migración final de limpieza que:
   - elimine definitivamente cualquier función de variante sobrante si existe,
   - notifique recarga de caché del backend,
   - garantice que no haya dependencias a `producto_variantes` ni `variante_id`.
5. Verificar creando una cotización con `PV4 + Gris + 0,4 mm` y confirmar que:
   - se calcula `m² = largo × cantidad`,
   - se calcula el total correcto,
   - no aparece el mensaje rojo de variantes.

**Resultado esperado**
El cotizador dejará de depender por completo del concepto “variante de stock” y el usuario no volverá a ver el error rojo aunque exista caché antigua durante la transición.