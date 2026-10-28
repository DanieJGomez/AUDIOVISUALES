LA IDEA DE ESTE DOCUMENTO ES QUE SEA LA PLANEACIÓN DEL PROYECTO

# CMB Audiovisuales

## 1. Objetivo

Desarrollar una aplicación web responsive para organizar la programación del ministerio audiovisual del Centro Misionero Bethesda Sede Centro (CMB). Las personas con el enlace podrán consultar la programación publicada sin iniciar sesión. Solo los usuarios autorizados podrán modificarla.

La aplicación deberá ser comprensible, segura, sincronizada en tiempo real y utilizable desde celular y computador.

## 2. Alcance por etapas

### Etapa 1. Estructura e interfaz
- Organizar el código en módulos separados por responsabilidad.
- Crear una interfaz responsive y accesible.
- Establecer estados visibles de carga, guardado, conexión y error.

### Etapa 2. Plano SVG
- Dibujar el salón con SVG propio, sin servicios externos de mapas.
- Representar altar, púlpito, batería, piano, coro, columnas, cámaras, fotografía, pantallas y mezcla de imagen.
- Mostrar el puesto, la persona asignada y el segmento en cada marcador.
- Representar conos de visión aproximados y permitir ajustar la orientación de las cámaras.
- Ubicar las pantallas entre cámara #2 y mezcla de imagen, más cerca de mezcla de imagen.
- Ajustar las posiciones reales a partir del plano que proporcione el ministerio. No inventar medidas.

### Etapa 3. Calendario y asignaciones
- Administrar la programación por fecha.
- Mantener independientes la primera reunión y el segundo servicio.
- Administrar personas y puestos sin modificar el código.
- Registrar tareas especiales, responsables e instrucciones.
- Registrar hora de llegada, vestimenta, descripción del color, observaciones, estado de publicación y última actualización.
- Permitir responsables diferentes para alabanza y prédica en dirección de escena.

### Etapa 4. Validación de conflictos
- Impedir que una persona tenga puestos incompatibles al mismo tiempo.
- Una asignación de todo el servicio entra en conflicto con cualquier segmento de esa reunión.
- Las asignaciones de alabanza y prédica pueden tener responsables distintos.
- Mostrar errores comprensibles y no aceptar asignaciones incompatibles.

### Etapa 5. Autenticación y permisos
- Implementar inicio de sesión con Google mediante Firebase Authentication.
- Permitir que un administrador autorice y retire editores.
- Mantener separados los datos públicos y los permisos administrativos.
- Exigir autorización en las reglas del servidor, no solo en la interfaz.
- Documentar el procedimiento seguro para crear al administrador inicial.

### Etapa 6. Datos y sincronización
- Utilizar Firebase Realtime Database como fuente compartida de datos.
- Separar los nodos `publicData/members`, `publicData/positions`, `publicData/map`, `publicData/schedules`, `access/admins` y `access/editors`.
- Publicar solo la información destinada a los servidores.
- Actualizar los dispositivos conectados mediante escuchas en tiempo real.
- Mostrar confirmación de guardado solo después de recibirla del servidor.
- Detectar cambios concurrentes y evitar sobrescrituras silenciosas.

### Etapa 7. Pruebas y seguridad
- Probar la consulta pública sin iniciar sesión.
- Probar que una persona no autorizada no pueda escribir, aunque manipule la interfaz.
- Probar los permisos de administradores y editores.
- Probar conflictos de asignación, errores de conexión y cambios concurrentes.
- Probar varios dispositivos y tamaños de pantalla.
- Verificar que no haya credenciales privadas ni reglas de escritura pública.

### Etapa 8. Construcción y publicación
- Verificar la instalación y las dependencias.
- Ejecutar las pruebas disponibles y la compilación de producción.
- Publicar en Firebase Hosting desde `dist`.
- Documentar instalación, configuración, pruebas, despliegue y limitaciones conocidas.

## 3. Posible ampliación futura: ministerio de alabanza

La aplicación podrá ampliarse para gestionar el ministerio de alabanza sin mezclar sus funciones con las de audiovisuales.

La ampliación se diseñará después de consolidar la base audiovisual. Deberá contemplar, según los requisitos que confirme el liderazgo:
- Integrantes, roles e instrumentos.
- Asignaciones por reunión.
- Dirección musical, voces e instrumentos.
- Horarios, instrucciones y observaciones.
- Validaciones de disponibilidad y conflictos.
- Permisos y datos compartidos de manera controlada.

No implementar funciones de alabanza hasta definir sus necesidades con el liderazgo. Diseñar la arquitectura para facilitar la ampliación sin añadir complejidad innecesaria ahora.

## 4. Arquitectura y restricciones

- HTML, CSS y JavaScript moderno, sin React.
- Vite para desarrollo y compilación.
- Firebase Hosting para archivos estáticos.
- Firebase Authentication con Google.
- Firebase Realtime Database.
- SVG propio para el plano.
- Mantener el proyecto dentro del plan gratuito Firebase Spark.
- No usar Cloud Functions, Blaze ni servicios que exijan pago.
- No usar `localStorage` como fuente principal de datos compartidos.
- No inventar configuración ni publicar reglas inseguras.
- Mantener las dependencias justificadas y el código legible.

## 5. Criterios de finalización

El proyecto no se considera terminado solo porque la página se vea bien o compile. Debe verificarse que:
- La programación se consulte sin iniciar sesión.
- Solo usuarios autorizados puedan editar.
- Los datos se compartan correctamente entre dispositivos.
- Las asignaciones y los conflictos se validen correctamente.
- Los errores de conexión y guardado sean visibles.
- Los cambios concurrentes no se pierdan silenciosamente.
- El diseño funcione en celular y computador.
- La compilación de producción termine sin errores.
- El despliegue y la configuración estén documentados.
- Las pruebas pendientes y las limitaciones estén declaradas.

## 6. Estado actual

Completar este apartado después de la auditoría del repositorio. No marcar funcionalidades como terminadas sin evidencia de implementación y pruebas.

## 7. Registro de trabajo

Al terminar cada sesión, registrar:
- Qué se implementó.
- Archivos modificados.
- Pruebas ejecutadas y resultados.
- Problemas encontrados.
- Próximo paso.
- Commit asociado.
