# Plan técnico: CMB Audiovisuales

> **Objetivo:** definir una primera versión de la aplicación para organizar las reuniones y los puestos del ministerio audiovisual, con consulta pública, edición autorizada y sincronización entre dispositivos.

La propuesta busca funcionar en la nube sin mantener el computador encendido, contratar un servidor ni pagar mientras el proyecto se mantenga dentro de las cuotas gratuitas vigentes. Los precios, las cuotas y la disponibilidad de los proveedores pueden cambiar; por eso, el costo cero no se puede garantizar para siempre.

## 1. Arquitectura recomendada

### Componentes

| Componente | Responsabilidad |
| --- | --- |
| **Firebase Hosting** | Publicar la interfaz web y servir los archivos de la aplicación mediante HTTPS. |
| **Firebase Realtime Database** | Guardar la programación y sincronizar los cambios con los dispositivos conectados. |
| **Firebase Authentication** | Identificar a los servidores que inician sesión para editar. |
| **HTML, CSS y JavaScript** | Construir la interfaz. |
| **Vite** | Organizar y compilar la aplicación, sin React en la primera versión. |
| **SVG** | Dibujar el plano interactivo del salón dentro de la aplicación. |
| **Git (opcionalmente GitHub)** | Mantener el control de versiones del código. |
| **PWA (mejora posterior)** | Permitir instalar la aplicación en dispositivos compatibles. |

Los celulares y computadores de los servidores acceden a la aplicación por internet. Firebase reúne el alojamiento, la base de datos y la autenticación; no hace falta comprar un servidor ni instalar una base de datos en el computador.

### ¿Por qué Realtime Database?

Los datos previstos —fechas, reuniones, personas, asignaciones, instrucciones y coordenadas— son relativamente pequeños. Realtime Database guarda los datos como una estructura JSON y permite escuchar cambios en partes específicas de esa estructura, lo que encaja con una programación que varias personas consultan y actualizan.

No se propone usar React en la primera versión: la interfaz inicial no necesita esa complejidad. Tampoco se plantea contratar un backend propio, un VPS, una API externa para mapas ni un servicio de almacenamiento de imágenes. Firebase tiene varios productos, pero se necesitan alojamiento, datos y autenticación para cubrir publicación, sincronización y permisos.

## 2. Sincronización entre dispositivos

El almacenamiento definitivo no estará en archivos JSON locales y el funcionamiento no dependerá de que el computador de desarrollo permanezca encendido.

### Flujo de actualización

1. Un servidor abre la URL de la aplicación.
2. La página consulta en Firebase la programación que necesita mostrar.
3. La aplicación mantiene una escucha activa sobre la reunión seleccionada.
4. Un servidor autorizado modifica una asignación y guarda el cambio.
5. Firebase notifica a los demás dispositivos que escuchan esos datos.
6. Las pantallas se actualizan sin que el usuario tenga que recargar la página.

En la implementación se puede usar `onValue()` para escuchar datos de Realtime Database. La escucha se ejecuta al conectarse y vuelve a ejecutarse cuando cambian los datos de la ubicación observada. Para reducir descargas, cada pantalla debe escuchar solo la información que necesita.

### Tiempo real y estado de guardado

La sincronización será en tiempo real, no mediante consultas repetidas cada varios segundos. No se puede garantizar retraso cero: depende de la conexión, del dispositivo y del estado del servicio.

La aplicación deberá:

- Usar las escuchas de Firebase en lugar de consultar con un temporizador cada segundo.
- Escuchar únicamente la programación o el servicio seleccionado.
- Actualizar solo los datos que hayan cambiado.
- Mostrar el estado de conexión y el estado del guardado.
- Confirmar un cambio como guardado solo cuando Firebase lo acepte.
- Avisar si no hay conexión o si una escritura falla.

Cuando Liseth o cualquier servidor autorizado cambie una asignación, el resto debería verla rápidamente mientras tenga la aplicación conectada.

El computador solo será necesario para desarrollar, compilar y publicar nuevas versiones. Una vez desplegada, Firebase sirve la aplicación desde sus propios servidores.

## 3. Costos y cuotas gratuitas

La opción prevista es el plan gratuito **Spark** de Firebase, sin vincular una cuenta de facturación.

| Recurso | Cuota gratuita publicada en la propuesta |
| --- | ---: |
| Firebase Hosting: almacenamiento | 10 GB |
| Firebase Hosting: transferencia de datos | 360 MB al día |
| Realtime Database: datos almacenados | 1 GB |
| Realtime Database: descarga de datos | 10 GB al mes |
| Realtime Database: conexiones simultáneas en Spark | 100 |
| Autenticación con proveedores distintos del teléfono | Opciones gratuitas disponibles |

Estas cuotas deben verificarse en la documentación oficial antes de publicar, ya que pueden cambiar. Para una programación de servicios que almacene principalmente texto y un plano SVG parecen suficientes para empezar, pero es una estimación y habrá que observar el uso real.

### Al alcanzar una cuota

En el plan Spark, superar la cuota de un producto puede suspender su uso durante el resto del periodo correspondiente, hasta que se restablezca la cuota o se cambie de plan. En Realtime Database, superar el límite de conexiones simultáneas puede hacer que se rechacen nuevas conexiones.

Esto permite buscar un costo de **$0 COP dentro de las cuotas** y sin activar facturación por exceso, a cambio de aceptar una posible interrupción si se supera un límite.

Para reducir ese riesgo:

- No vincular una cuenta de facturación ni cambiar al plan Blaze.
- No usar funciones de servidor que requieran servicios de pago.
- No alojar fotografías ni vídeos del ministerio en esta aplicación.
- Mantener pequeños los archivos de la interfaz.
- Revisar periódicamente el consumo y las cuotas de Firebase.
- Evitar APIs de mapas y otros servicios que añadan facturación.
- No comprar un dominio propio en esta etapa; la dirección gratuita es suficiente.

## 4. URL y publicación

Firebase Hosting proporciona una URL con un formato similar a:

```text
https://ID-DEL-PROYECTO.web.app
```

También proporciona un subdominio de `firebaseapp.com`. Ambos sirven el contenido del proyecto mediante HTTPS. Se podría intentar un identificador como `cmb-audiovisuales-centro`, pero la disponibilidad debe comprobarse al crear el proyecto.

### Pasos de publicación

1. Crear el proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Registrar la aplicación web.
3. Activar Authentication y crear Realtime Database.
4. Preparar el proyecto local con Vite.
5. Configurar Firebase Hosting para publicar la carpeta compilada.
6. Ejecutar el despliegue.
7. Compartir con los servidores la URL que Firebase proporcione.

Firebase CLI permite inicializar Hosting y desplegar la aplicación. GitHub puede servir como copia de seguridad y para el control de versiones, pero no es obligatorio para que la aplicación funcione.

### Si el computador está apagado

Después de publicar, el código y los datos estarán en los servicios de Firebase. Los servidores podrán acceder a la URL desde sus propios dispositivos aunque el computador de desarrollo esté apagado. Para corregir el mapa o añadir funciones sí será necesario trabajar localmente y desplegar una nueva versión.

## 5. Seguridad y permisos

El requisito es permitir que cualquiera con el enlace consulte la programación, pero que solo las personas autorizadas puedan modificarla.

| Acción | Permiso |
| --- | --- |
| Consultar la programación, puestos, nombres asignados, instrucciones y vestimenta | Pública, sin iniciar sesión |
| Editar la programación | Solo servidores autorizados que hayan iniciado sesión |
| Administrar permisos de edición | Administradores autorizados |

Se recomienda iniciar sesión con Google para facilitar el acceso y evitar gestionar contraseñas. Iniciar sesión **no** debe conceder permiso para editar automáticamente: cada cuenta debe estar en la lista de editores aprobados.

Las reglas de Firebase Realtime Database serán la protección real. Ocultar botones en la interfaz no basta. Las reglas pueden revisar la identidad del usuario autenticado y sus permisos antes de aceptar una escritura.

### Configuración inicial de acceso

1. Crear el proyecto y activar el acceso con Google.
2. Iniciar sesión con la cuenta administradora.
3. Obtener el identificador único del usuario.
4. Registrar ese usuario como administrador inicial en Firebase.
5. Autorizar a los demás servidores desde el mecanismo administrativo.
6. Permitir que los servidores autorizados inicien sesión para editar.

La estructura debe separar los datos públicos —programaciones, puestos, personas e instrucciones— de los datos de autorización. Nunca se debe permitir escritura anónima sobre todo el árbol de la base de datos. Tampoco se debe incluir una clave privada de administrador o de cuenta de servicio en el JavaScript público: la seguridad debe depender de las reglas del servidor, no de un secreto oculto en el navegador.

## 6. Requisitos funcionales de la primera versión

El alcance inicial debe resolver el trabajo real del ministerio antes de incorporar funciones adicionales.

### A. Programación de reuniones

- Seleccionar la fecha del culto.
- Crear una o varias reuniones para una misma fecha.
- Diferenciar la primera reunión del segundo servicio.
- Consultar programaciones anteriores y futuras.
- Indicar si la programación está en borrador o publicada.
- Registrar la última actualización y quién la hizo.
- Permitir cambios posteriores sin crear otra programación por accidente.

### B. Asignación de puestos

| Puesto | Asignación |
| --- | --- |
| Cámara principal | Una persona por segmento |
| Cámara #1 | Una persona por segmento |
| Cámara #2 | Una persona por segmento |
| Fotografía | Una persona responsable |
| Pantallas, transmisión y letras | Una persona responsable |
| Dirección de escena | Una persona, con posible cambio entre alabanza y prédica |

La lista de servidores debe poder administrarse desde la aplicación. Si ingresa una persona nueva, no debe ser necesario modificar manualmente el JavaScript para que aparezca como opción.

Cada puesto tendrá un identificador técnico fijo. El nombre visible podrá cambiar sin romper las asignaciones antiguas.

### C. Prevención de asignaciones incompatibles

El sistema debe evitar que una persona quede asignada a varias cámaras al mismo tiempo.

- Cada asignación corresponde a una reunión y a un segmento.
- Los segmentos iniciales serán **Todo el servicio**, **Alabanza** y **Prédica**.
- Una asignación de **Todo el servicio** entra en conflicto con cualquier otra función de esa persona en esa reunión.
- Una asignación durante alabanza puede coexistir con otra durante prédica, porque corresponden a momentos distintos.
- La aplicación debe advertir del conflicto e impedir guardar una asignación incompatible.
- Las excepciones futuras deben configurarse explícitamente; no deben aparecer por accidente.
- La primera y la segunda reunión tienen asignaciones independientes, para permitir que una persona cambie de puesto sin generar un falso conflicto.

### D. Tareas e instrucciones

Las tareas especiales no deben confundirse con las posiciones físicas de las cámaras. Cada programación podrá incluir tareas con responsable y descripción, por ejemplo:

- Entrega y recogida del sistema de monitoreo.
- Preparación de la monitorización de alabanza.
- Envío de ideas de contenido para grabar.
- Recomendaciones para cargar, almacenar y cuidar cámaras y micrófonos.

Las recomendaciones generales también podrán guardarse como texto para que el encargado las reutilice o adapte al publicar una programación.

### E. Vestimenta

El formulario permitirá elegir la fecha del culto y configurar el color de vestimenta. Debe guardarse una descripción completa —por ejemplo, **verde oscuro**— y se podrá añadir una observación.

El color tendrá un nombre legible y un selector visual. La etiqueta debe disponer de espacio suficiente en celulares para que no se corte.

### F. Plano interactivo

El plano será un SVG propio dibujado dentro del proyecto. Incluirá:

- Contorno del salón y columnas.
- Altar, púlpito, batería y piano.
- Ubicación aproximada del coro y las pantallas.
- Posiciones de la cámara principal, cámara #1, cámara #2 y fotografía.
- Puestos de mezcla de imagen y de pantallas, transmisión y letras.
- Orientación aproximada y cono de encuadre de cada cámara.

Cada puesto tendrá coordenadas ajustables y un marcador seleccionable. Al tocarlo, aparecerán el nombre del puesto, la persona asignada y el segmento correspondiente.

Las posiciones iniciales serán coordenadas relativas al salón; no se presentarán como medidas a escala sin contar con ellas. Las ubicaciones se ajustarán con el dibujo y las indicaciones que se proporcionen. Los conos de cámara serán aproximados hasta confirmar sus direcciones reales.

El puesto de pantallas debe quedar entre la cámara #2 y la mezcla de imagen, más cerca de la mezcla que de la cámara #2.

## 7. Organización de los datos

La siguiente estructura es una propuesta para Realtime Database; no implica que ya exista en Firebase:

```text
/
├── publicData/
│   ├── members/
│   ├── positions/
│   ├── map/
│   └── schedules/
│       └── AAAA-MM-DD/
│           ├── first-service/
│           └── second-service/
└── access/
    ├── admins/
    └── editors/
```

| Rama | Contenido |
| --- | --- |
| `members` | Personas asignables, nombre visible y estado activo. |
| `positions` | Identificadores, nombres, tipo y color de los puestos. |
| `map` | Elementos del plano y sus coordenadas relativas. |
| `schedules` | Programaciones por fecha y reunión, con asignaciones, segmentos, tareas, instrucciones, vestimenta y metadatos de actualización. |
| `access` | Usuarios autorizados para editar y administradores que pueden gestionar permisos. |

No conviene que cada pantalla escuche toda la base de datos. El mapa escuchará los datos del plano; la vista del culto, la programación seleccionada; y el sistema de permisos, su información específica. Así se evita transferir datos innecesarios.

### Ediciones simultáneas

Si dos personas modifican la misma programación al mismo tiempo, la aplicación no debe reemplazar silenciosamente el trabajo de una con el de la otra.

- Actualizar cada asignación de manera independiente siempre que sea posible.
- Si se detecta una actualización simultánea, informar del cambio y permitir revisar la versión actual antes de sobrescribirla.
- Guardar quién hizo la última modificación y cuándo ocurrió.

Para la primera versión no hace falta un historial de auditoría complejo.

## 8. Construcción y herramientas

La IA local puede generar la estructura y modificar archivos, pero conviene trabajar por etapas y con instrucciones estables, en lugar de pedir toda la aplicación en una sola operación.

### Estructura inicial sugerida

```text
cmb-audiovisuales/
├── index.html
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.js
│   ├── styles.css
│   ├── firebase.js
│   ├── auth.js
│   ├── database.js
│   ├── scheduling.js
│   ├── assignments.js
│   ├── map.js
│   └── ui/
├── database.rules.json
├── firebase.json
├── package.json
└── README.md
```

Es una estructura inicial, no una obligación. La IA podrá ajustarla si existe una razón técnica clara, pero no deberá añadir frameworks y servicios sin necesidad.

### Programas necesarios

| Herramienta | Uso |
| --- | --- |
| Node.js LTS y npm | Ejecutar Vite e instalar dependencias. |
| IA local | Crear y revisar los archivos del proyecto. |
| Firebase CLI | Inicializar y desplegar el proyecto. |
| Navegador | Probar la interfaz y los permisos. |
| Git | Registrar cambios y recuperar versiones anteriores; recomendable. |

No se necesitan XAMPP, Apache, MySQL, PHP ni un servidor web local permanente. La aplicación se ejecutará en el navegador y consumirá los servicios de Firebase.

### Configuración local

Primero, crear el proyecto Firebase, registrar una aplicación web y activar Authentication con Google y Realtime Database. La región de la base de datos se debe elegir cuidadosamente, porque no es un archivo local que se pueda mover con un clic.

El flujo local inicial será parecido a este:

```sh
npm create vite@latest cmb-audiovisuales -- --template vanilla
cd cmb-audiovisuales
npm install
npm install firebase
npm run dev
```

Esto crea una aplicación base de JavaScript sin React. Firebase deberá integrarse con su SDK modular, sin inventar versiones ni mezclar sintaxis antigua y moderna.

Después de revisar las pantallas, instalar y configurar Firebase CLI, iniciar sesión y vincular el proyecto local al proyecto correcto:

```sh
npm install -g firebase-tools
firebase login
firebase init hosting database
```

En la configuración de Hosting, la carpeta pública de despliegue debe ser `dist`, donde Vite genera la versión compilada. La configuración también debe desplegar las reglas de seguridad de la base de datos.

Antes de publicar:

```sh
npm run build
firebase deploy --only hosting,database
```

Antes de ejecutar esos comandos, verificar las rutas de despliegue en `firebase.json`. **No publicar reglas provisionales que permitan escribir a todo el mundo**: las reglas de lectura y escritura deben probarse antes del despliegue real.

## 9. Plan de trabajo de diez días

El calendario es razonable si se puede dedicar tiempo diariamente y la IA local funciona correctamente, pero no garantiza que todas las pruebas salgan bien a la primera.

| Días | Etapa | Trabajo |
| --- | --- | --- |
| 1–2 | Estructura y requisitos | Preparar el proyecto, las pantallas básicas, la lista de puestos, los segmentos y el modelo de datos. Evitar funciones fuera del alcance. |
| 3–4 | Mapa y asignaciones | Dibujar el salón en SVG, añadir el púlpito y los instrumentos, incorporar los marcadores y desarrollar reuniones y asignaciones. |
| 5–6 | Datos compartidos y acceso | Integrar Firebase, crear el inicio de sesión, establecer reglas, probar permisos y verificar la prevención de conflictos. |
| 7–8 | Sincronización y pruebas | Probar varios dispositivos a la vez, cambios simultáneos, conexión interrumpida, vista móvil y persistencia de datos. |
| 9–10 | Publicación y correcciones | Desplegar en Firebase Hosting, compartir la URL con algunos servidores de confianza, corregir errores y preparar una guía sencilla de uso. |

Para cumplir el plazo, se dejan fuera de la primera entrega las notificaciones push, un historial de auditoría completo, estadísticas, exportaciones avanzadas y un panel para editar gráficamente el plano. El mapa sí mostrará los puntos y sus encuadres aproximados; durante esta primera versión, la distribución detallada podrá ajustarse directamente en los datos del plano.

## 10. Pruebas antes de compartir la aplicación

La aplicación no estará lista solo porque abra correctamente en el computador de desarrollo. Debe superar estas pruebas:

| Prueba | Resultado esperado |
| --- | --- |
| Abrir el enlace en un celular sin sesión | Puede consultar la programación publicada. |
| Iniciar sesión con una cuenta no autorizada | No puede editar. |
| Iniciar sesión con un servidor autorizado | Puede editar y guardar. |
| Cambiar una cámara desde un segundo dispositivo | El primer dispositivo recibe el cambio. |
| Asignar a una persona a dos puestos simultáneos | El conflicto se bloquea. |
| Cambiar responsable entre alabanza y prédica | Se permite si los horarios no se superponen. |
| Crear dos reuniones el mismo día | Las asignaciones son independientes. |
| Cambiar el color de vestimenta | Se muestra el nombre completo. |
| Intentar escribir sin conexión | La interfaz informa del problema y no afirma que el cambio se guardó. |
| Apagar el computador de desarrollo | La versión publicada sigue disponible. |
| Probar desde otro navegador | Los datos provienen de Firebase, no del almacenamiento local del primer navegador. |

La última prueba demuestra que la sincronización es real y que la aplicación no sigue usando un prototipo local como si fuera un sistema compartido.

## 11. Decisión final

La ruta elegida queda así:

- **Alojamiento:** Firebase Hosting.
- **Datos:** Firebase Realtime Database.
- **Autenticación y permisos:** Firebase Authentication y reglas de seguridad.
- **Código:** JavaScript sin React, compilado con Vite.
- **Plano:** SVG propio y ajustable.
- **URL:** subdominio gratuito `web.app`.
- **Costo previsto:** cero mientras se respeten las cuotas gratuitas vigentes y no se active un plan de pago.
- **Plazo:** diez días para una primera versión probada, con el mapa y la programación como prioridades.

> **Aviso de privacidad:** la URL podrá consultarse públicamente, por lo que el contenido visible debe considerarse público. No incluir información sensible de los servidores, datos personales innecesarios ni credenciales en la programación.

El primer paso es crear el proyecto en Firebase, registrar la aplicación web y activar Realtime Database y Authentication. Después, la IA local puede generar la estructura del código y el mapa sin comprometer todavía los permisos ni la publicación final.

### Fuentes oficiales

- [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart)
- [Realtime Database: lectura y escritura](https://firebase.google.com/docs/database/web/read-and-write)
- [Reglas de seguridad de Realtime Database](https://firebase.google.com/docs/database/security)
- [Planes de precios de Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
