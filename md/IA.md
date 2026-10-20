Actúa como un ingeniero de software sénior. Desarrolla una aplicación web para el ministerio audiovisual del Centro Misionero Bethesda Sede Centro (CMB), siguiendo estrictamente estas especificaciones.

OBJETIVO
Una aplicación web móvil para programar los servicios audiovisuales de la iglesia. Cualquier persona con el enlace puede consultar la programación sin iniciar sesión. Solo servidores autorizados pueden editar, y todos los servidores aprobados deben poder editar.

ARQUITECTURA OBLIGATORIA
- HTML, CSS y JavaScript moderno, sin React.
- Vite como herramienta de desarrollo y compilación.
- Firebase Hosting para publicar los archivos estáticos.
- Firebase Realtime Database como almacenamiento compartido y sincronización en tiempo real.
- Firebase Authentication con inicio de sesión de Google para editores.
- SVG propio para el plano del salón, sin APIs de mapas externas.
- Mantener el proyecto dentro del plan gratuito Spark; no activar facturación, Blaze, Cloud Functions ni servicios que exijan pago.
- No usar localStorage como fuente principal de datos compartidos. Puede usarse solo para preferencias o, con cuidado, una copia de lectura temporal.
- No inventar configuración Firebase ni publicar reglas inseguras. Usar placeholders hasta que el propietario proporcione la configuración real.

FUNCIONES
1. Programación por fecha, con primera reunión y segundo servicio independientes.
2. Puestos: cámara principal, cámara #1, cámara #2, fotografía, pantallas/transmisión/letras y dirección de escena.
3. Dirección de escena permite asignar responsables distintos durante alabanza y prédica.
4. Impedir que una persona esté asignada simultáneamente a puestos incompatibles. “Todo el servicio” entra en conflicto con cualquier segmento de la misma reunión; alabanza y prédica pueden tener responsables diferentes.
5. Personas administrables sin cambiar el código.
6. Tareas especiales por reunión, responsable y descripción.
7. Instrucciones generales, hora de llegada, estado de publicación y última actualización.
8. Vestimenta del día con descripción completa del color, selector visual y observaciones.
9. Plano interactivo con altar, púlpito, batería, piano, coro, columnas, cámaras, fotografía, pantallas y mezcla de imagen.
10. Cada marcador del plano muestra puesto, persona asignada y segmento. Representar los encuadres de las cámaras con conos de visión aproximados y orientaciones ajustables.
11. La ubicación de pantallas debe ser entre cámara #2 y mezcla de imagen, más cerca de mezcla de imagen. Las posiciones reales se calibrarán con el dibujo proporcionado por el usuario; no inventar medidas exactas.
12. Actualizaciones visibles para todos los dispositivos conectados mediante escuchas en tiempo real, sin polling constante.
13. Indicadores de guardado, conexión, errores y cambios concurrentes. No afirmar que se guardó hasta recibir confirmación.
14. Probar varios dispositivos y evitar que dos editores sobrescriban silenciosamente sus cambios.

SEGURIDAD
- La consulta pública se limita a los datos destinados a los servidores.
- La escritura requiere usuario autenticado y autorización explícita en las reglas del servidor.
- No basta con ocultar botones de edición en la interfaz.
- Mantener separados los datos públicos y los permisos de administradores/editores.
- Crear un administrador inicial mediante el procedimiento documentado y permitir que este autorice editores.
- Nunca usar reglas globales de escritura pública, credenciales privadas de servidor en el navegador ni modo de prueba abierto.

ESTRUCTURA DE DATOS
Organizar Realtime Database con nodos separados para publicData/members, publicData/positions, publicData/map, publicData/schedules y access/admins, access/editors. Cada fecha puede contener first-service y second-service. Documentar el esquema antes de conectarlo.

MODO DE TRABAJO
Desarrolla por fases: (1) estructura e interfaz; (2) plano SVG; (3) calendario y asignaciones; (4) validación de conflictos; (5) Firebase Authentication y reglas; (6) datos y sincronización; (7) pruebas de seguridad; (8) compilación, publicación y documentación.
Antes de cambiar archivos, inspecciona el proyecto existente y crea una copia de seguridad o utiliza control de versiones. No reemplaces trabajo sin explicar por qué.
Después de cada fase, ejecuta las pruebas disponibles, explica qué cambió, qué falta y cómo verificarlo. No simules que una integración funciona si no se ha probado.

REQUISITOS DE ENTREGA
- Código legible y separado por responsabilidades.
- Diseño responsive para celular.
- README con instalación, configuración Firebase, pruebas y despliegue.
- Reglas de seguridad comentadas y probadas.
- Archivo de configuración con placeholders claramente identificados.
- Instrucciones para publicar en Firebase Hosting desde la carpeta compilada dist.
- Lista explícita de límites conocidos y pruebas pendientes.

Prioriza la fiabilidad, la seguridad, el bajo coste y la comprensión del código. No añadas servicios, dependencias ni funciones fuera del alcance sin explicar la necesidad y solicitar aprobación.