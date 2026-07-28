Entrego solo el texto del prompt reutilizable (sin cambios en la app).

## Prompt sugerido

> **Objetivo:** Permitir que cualquier perfil de administrador (Administrador General, Administrador y Operador) pueda ingresar ventas por motivo "chatarra" en el Panel Administrativo de Fermaval.
>
> **Requisitos funcionales**
> - Habilitar la sección "Ingresos por venta de chatarra" dentro de `/admin/finanzas` para todos los perfiles con rol en `user_roles` (admin y operator). No restringir al Superadmin.
> - El formulario debe permitir registrar: **Fecha** (por defecto hoy, no futura), **Monto en CLP** (entero ≥ 0), y **Descripción opcional** (máx. 500 caracteres).
> - Listar las ventas registradas en una tabla (fecha, monto, descripción) con opción de eliminar cada registro, con confirmación previa.
> - Los montos deben sumarse automáticamente a las "Ganancias del mes", al "Balance neto" y al gráfico de evolución de 12 meses en el Dashboard de Finanzas.
>
> **Requisitos de datos y seguridad**
> - Tabla `public.ventas_chatarra` con RLS activada. Políticas de SELECT / INSERT / UPDATE / DELETE únicamente para `is_staff(auth.uid())` (cualquier usuario con rol en `user_roles`).
> - Registrar `created_by = auth.uid()`, `created_at` y `updated_at` automáticos.
> - Auditar cada operación mediante el trigger `trg_audit_row` (consistente con otras tablas críticas).
>
> **Requisitos de UI/UX**
> - Card visible dentro de `/admin/finanzas`, con ícono `Recycle` y título "Ingresos por venta de chatarra".
> - Mostrar acumulado total registrado en la esquina superior derecha de la Card.
> - Toast de éxito al guardar/eliminar y toast de error si el monto es inválido o la fecha está vacía.
> - Invalidar las queries `["ventas_chatarra"]` y `["dashboard"]` tras cada mutación.
>
> **Fuera de alcance:** no modificar movimientos históricos, egresos, boletas, ni el resto del panel de finanzas.

Este prompt está listo para copiar/pegar en una futura conversación con Lovable. No requiere cambios en el código actual.
