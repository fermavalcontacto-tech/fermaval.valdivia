
# Plataforma FERMAVAL — Cubiertas y Revestimientos

Construcción completa: vista pública con cotizador y panel administrativo con 4 perfiles (3 operadores + 1 admin general), sobre TanStack Start + Lovable Cloud + Lovable Emails.

## Decisiones confirmadas
- **Imágenes**: ya cargué tu logo (cuadrado y horizontal) y la imagen de productos al CDN. Las usaré en la home y la versión horizontal como logo en header. Los 3 colores (Terracota, Gris, Negro) los sembraré en la BD con muestras visuales generadas a partir de tu imagen de productos.
- **Pagos**: simulados. El botón "Aceptar cotización y pagar" registra monto, % elegido (20 o 50), saldo y estado. Listo para conectar Webpay/Transbank manualmente cuando lo tengas.
- **Correos**: Lovable Emails. Te mostraré el botón para configurar el subdominio de envío en cuanto el esquema esté listo.
- **Usuarios**: creo los 4 con las credenciales exactas que enviaste. Recomendable cambiarlas tras el primer login.

## Identidad visual
- Paleta extraída de tu logo: azul marino profundo `#1a2438`, naranja/rojo señalético `#e85a3a`, blanco hueso `#f5f3ee`, gris industrial.
- Tipografía: **Bebas Neue** o **Outfit** para titulares (industrial, geométrica) + **Inter** para texto.
- Estilo industrial limpio: bandas diagonales del logo como motivo gráfico, tarjetas con bordes definidos, sombras secas.
- Totalmente responsive (móvil, tablet, desktop).

## Áreas

### 1. Vista pública `/`
- Header con logo horizontal + CTA Linktree + acceso admin.
- Hero: imagen, precio destacado **$7.990 / m²**, CTA "Cotiza ahora" y "Linktree".
- Sección **Productos / Colores**: tarjetas con muestra visual + nombre (editables desde admin).
- **Cotizador**: largo, ancho, m² (auto), color, datos del cliente (nombre, teléfono, correo, dirección). Calcula total = m² × precio.
- Página de cotización `/cotizacion/$numero`: número único, fecha, datos, medidas, color, total, leyenda "Tu pedido estará listo en un plazo máximo de 72 horas una vez recibida la confirmación y pago correspondiente." + botón **"Aceptar cotización y pagar"** con elección 20% / 50%.
- Al aceptar: guarda pago, calcula saldo, cambia estado a "Pago parcial recibido", dispara correo a los 4 perfiles.
- Sección **Visítanos**: mapa embebido + botón "Cómo llegar" → `https://maps.app.goo.gl/3ucmNxorotuaexNg7`.
- Footer con contacto (+56 9 3012 6744, @fermaval.valdivia).

### 2. Auth `/auth`
- Login email/password (Lovable Cloud).
- 4 usuarios sembrados con las credenciales que enviaste.
- Roles en tabla `user_roles` (`admin` / `operator`) con `has_role()` security definer.

### 3. Panel `/admin` (operadores + admin general)
- **Dashboard**: tarjetas (ventas del mes, cotizaciones pendientes, pedidos confirmados, ganancias, gastos) + gráficos (ganancias por mes, comparación mensual, aceptadas vs rechazadas) con Recharts.
- **Cotizaciones**: tabla con N°, cliente, fecha, estado, total, pagado, saldo. Crear manual, editar, cambiar estado, descargar PDF.
- **Pedidos**: vista por estado (Cotización creada → Esperando pago → Pago parcial → Confirmado → Terminado).
- **Solicitudes de egreso**: crear (tipo, descripción, monto, fecha). Estados pendiente / aprobado / rechazado. Aprobar dispara correo a los 4.
- **Boletas / comprobantes**: subir archivo (Supabase Storage privado), clasificado por tipo (Materiales, Transporte, Herramientas, Servicios, Otros).
- **Finanzas**: ganancias totales, utilidades (total − gastos), IVA (19 %) por mes.
- **Reportes**: descargar Excel mensual con hojas Ventas, Gastos, Resumen.

### 4. Solo admin general (`fermaval.contacto@gmail.com`)
- **Configuración web**: editar precio/m², logo, imagen hero, info comercial, link Linktree, link mapa.
- **Gestión de colores**: crear / editar / eliminar / reordenar (con muestra visual).
- Ver todas las solicitudes con solicitante, fecha, monto, estado.
- Aprobar / rechazar egresos.
- Descargar todos los reportes.

## Esquema de base de datos
- enum `app_role` (`admin`, `operator`)
- `user_roles(user_id, role)` + `has_role()` security definer
- `configuracion_web` (fila única: precio_m2, logo_url, hero_url, info, linktree_url, mapa_url, mapa_embed, telefono, direccion)
- `colores(id, nombre, hex, imagen_url, activo, orden)`
- `clientes(id, nombre, telefono, correo, direccion)`
- `cotizaciones(id, numero, cliente_id, largo_m, ancho_m, metros2, color_id, precio_m2, total, estado, pago_recibido, saldo, plazo_horas, created_by, created_at)`
- `pagos(id, cotizacion_id, porcentaje, monto, metodo, estado)`
- `solicitudes_egreso(id, tipo, descripcion, monto, fecha, solicitante_id, estado, decidido_por, decidido_at)`
- `boletas(id, solicitud_id?, tipo_gasto, descripcion, monto, fecha, archivo_url, subido_por)`
- Buckets: `boletas` (privado) y `web-assets` (público, solo admin escribe).
- RLS: público lee `colores` y `configuracion_web`; público inserta cliente/cotización/primer pago vía server fn validada; operadores y admin gestionan todo lo interno; solo admin edita configuración y colores.

## Correos automáticos (Lovable Emails)
Plantillas React Email:
1. `quote-accepted` — al aceptar cotización (a los 4).
2. `expense-approved` — al aprobar egreso (a los 4).
3. `order-confirmed` — al pasar pedido a "Confirmado".

## Stack técnico
- Rutas públicas: `/`, `/cotizacion/$numero`, `/auth`.
- Rutas protegidas bajo `_authenticated/`: `/admin`, `/admin/cotizaciones`, `/admin/pedidos`, `/admin/egresos`, `/admin/boletas`, `/admin/finanzas`, `/admin/reportes`, `/admin/configuracion` (solo admin), `/admin/colores` (solo admin).
- Server functions para: crear cotización pública, registrar pago, aprobar egreso, generar Excel mensual (con xlsx en el servidor).
- Server route `/api/cotizacion/pdf/$numero` para PDF descargable.

## Orden de implementación
1. Habilitar Lovable Cloud + esquema + seeds (usuarios, colores Terracota/Gris/Negro, configuración inicial).
2. Design system (tokens, tipografías, variantes shadcn).
3. Vista pública (header, hero, colores, cotizador, mapa, footer) + página de cotización + flujo pago.
4. Auth + layout admin + dashboard.
5. Cotizaciones, pedidos, egresos, boletas.
6. Finanzas + gráficos + exportar Excel.
7. Configuración (admin general) + gestión de colores.
8. Plantillas de correo + triggers + setup email infra.
9. Sitemap/robots + SEO.

## Notas
- El cobro real no se ejecuta; cuando integres Webpay solo se reemplaza una server fn.
- Lovable Emails requerirá que configures un subdominio (te muestro el botón cuando llegue ese paso).
- Setup de email infra completa su activación en el siguiente mensaje tuyo (limitación conocida del cron); el resto funciona desde ya.

¿Apruebas que avance?
