# Quitar el RUT duplicado en "Nueva cotización (interna)"

## Qué muestra la captura

En el móvil aparece el diálogo con dos campos "RUT (opcional)" seguidos, y el primer campo dice "Nombre *".

## Estado real del código

En `src/routes/_authenticated.admin.cotizaciones.tsx` los dos diálogos (nueva cotización y editar cotización) ya tienen **un solo** campo RUT, y la etiqueta del nombre ya es "Nombre o razón social (opcional)". Es decir, la versión que estás viendo en fermaval.com es una compilación anterior a esa corrección: el duplicado ya no existe en el código actual.

## Plan

1. Publicar de nuevo el sitio para que fermaval.com sirva la versión actual (sin RUT duplicado y con "Nombre o razón social (opcional)").
2. Verificar el diálogo en vista móvil tras el despliegue: debe mostrar, en este orden, Nombre o razón social, RUT, Giro o actividad, Teléfono, Correo, Dirección — un solo RUT.
3. Si después de recargar con caché limpia el duplicado siguiera apareciendo, revisar el diálogo real que estás usando (podría ser otro formulario, por ejemplo el cotizador público) y eliminar ahí el campo repetido.

## Notas técnicas

- Archivo involucrado: `src/routes/_authenticated.admin.cotizaciones.tsx` (líneas ~764-769 en el editor y ~897-902 en el diálogo de creación).
- No se requieren cambios de base de datos ni de lógica; el campo RUT sigue siendo opcional y se guarda en `clientes.rut`.
