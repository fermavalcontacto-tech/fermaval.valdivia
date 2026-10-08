# Plan: Publicar los últimos cambios en fermaval.com

## Objetivo
Llevar a producción (fermaval.com) todos los cambios aún no publicados del proyecto.

## Alcance
Los cambios pendientes incluyen:

- Vinculación de compras de bobinas al APU (costo promedio ponderado por color y mes, con trigger automático).
- Serie financiera de 12 meses: ventas netas, costo de venta (bobina → APU → costo genérico), gastos y utilidad real, incluyendo ingresos por chatarra.
- Compras de bobina excluidas de gastos operacionales para no duplicar costo.
- Saldo de cotizaciones mostrando y guardando el total con IVA ("Saldo (IVA incluido)") en listado admin, formulario, vista cliente y PDF, con saldos históricos actualizados.

## Pasos

1. **Verificación previa (rápida)**
   - Confirmar que no existen errores de build ni hallazgos críticos de seguridad (ya revisado: sin hallazgos).

2. **Publicación**
   - Solicitar la publicación del proyecto mediante el flujo de publicación.
   - La URL esperada es https://fermaval.com (con dominio personalizado conectado).

3. **Confirmación**
   - Informar que la publicación fue solicitada; el despliegue tarda típicamente ~1 minuto.
   - No se promete disponibilidad inmediata; si el usuario reporta contenido desactualizado, republicar.

## Lo que NO se incluye
- Cambios en el saldo pendiente: las opciones de pago 50%/100% siguen calculándose sobre el neto (queda como mejora futura pendiente de decisión).
- No se modifican precios, reglas de negocio ni estructuras de datos.
