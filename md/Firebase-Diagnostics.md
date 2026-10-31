# Firebase: esquema privado y proyeccion publica

## Estado

`database.rules.json` sigue denegando toda lectura y escritura. `firebase.json` apunta a ese archivo. `database.rules.proposed.json` es una propuesta local reforzada y probada con el emulador RTDB; no se publico ni se probo contra Firebase remoto. El cliente de `src/firebase.js` no demuestra que RTDB exista o que Email/Password este habilitado.

## Rutas y contrato de programacion

La fuente canonica que usan `src/scheduling.js` y `src/main.js` es:

- Privada: `schedules/<fecha>/<reunion>`.
- Proyeccion: `publicData/schedules/<fecha>/<reunion>`.

El registro privado contiene `assignments`, `people`, `tasks`, `arrival`, `dress`, `dressColor` y `notes`. Al guardarlo se agregan `updatedAt` y `updatedBy`. Las asignaciones y la lista de personas contienen nombres; las notas y tareas son texto libre; el UID identifica al editor. Esos campos permanecen privados.

La propuesta valida los seis campos de detalle y metadatos requeridos; asignaciones con puestos conocidos; personas como lista de hasta 100 nombres; tareas como lista de hasta 100 objetos con texto, estado booleano y responsable; límites de longitud por texto; y `updatedBy` igual al UID autenticado. Rechaza campos adicionales y elimina la posibilidad de borrar el nodo completo de una programación mediante las reglas.

La proyeccion publica admite solo `published` y `assignments` (si no hay puestos asignados, RTDB puede omitir el objeto vacio):

```json
{
  "published": false,
  "assignments": {
    "camera1": "Nombre aprobado"
  }
}
```

`assignments` solo acepta los puestos `mainCamera`, `camera1`, `camera2`, `photo`, `lyrics`, `stageFirst` y `stageSermon`, con valores string de hasta 80 caracteres. `lyrics` representa el puesto combinado de transmisión, pantallas y letras; `stageFirst` y `stageSermon` permiten responsables distintos para dirección de escena durante alabanza y prédica. No se proyectan `people`, `tasks`, horarios, vestimenta, notas, fechas de edicion ni UID. La fecha y la reunion forman parte de la ruta.

Los nombres asignados tambien son datos personales. La proyeccion queda `published: false` por defecto. Un administrador debe confirmar explicitamente que publica los nombres de esa reunion. Si no se aprueba su publicacion, debe permanecer sin publicar. Los usuarios anonimos solo pueden leer el registro cuando `published` sea `true`; los editores y administradores pueden leer borradores.

`publicData/members`, `publicData/positions`, `publicData/map`, `venueMap` y las otras rutas no tienen permisos en la propuesta: no hay contrato local suficiente para exponerlas. `src/map.js` y `src/assignments.js` definen rutas heredadas (`venueMap` y `schedules/<fecha>/<reunion>/assignments/<puesto>`), pero no se importan en la interfaz actual. La ruta de asignaciones permanece bajo el permiso de su reunion privada.

## Coherencia y conflictos

`schedules` es la fuente canonica. El editor compara su version con la transaccion remota antes de guardarla. La proyeccion es una vista derivada, nunca se copia el registro privado completo.

Si una proyeccion ya esta publicada, la interfaz primero la despublica mediante una transaccion comparada y luego guarda la fuente privada. Las reglas del servidor bloquean escrituras privadas mientras la proyeccion esta publicada. La publicacion valida en el servidor que las asignaciones coincidan con la fuente privada actual. Esto evita que una edicion deje expuesta una vista vieja mientras se modifica la fuente.

La fuente y la proyeccion son dos transacciones RTDB separadas; no son atomicas entre si. Si falla la segunda transaccion, la interfaz informa que la fuente privada se guardo pero que la proyeccion esta pendiente. La vista permanece oculta hasta una sincronizacion y publicacion aprobadas. No se marca una sincronizacion completa en silencio. Las transacciones comparadas evitan reemplazar cambios concurrentes.

La escritura privada conserva campos desconocidos del registro previo. `localStorage` no se migra ni se borra; la vista publica limpia en memoria los campos privados que pudiera haber cargado el navegador.

## Acceso y reglas propuestas

La raiz niega lectura y escritura. Solo el hijo exacto de `publicData/schedules/<fecha>/<reunion>` tiene permiso de lectura, y solo si esta publicado o quien consulta es editor/admin autorizado. El registro publico exige `published` booleano, `assignments` con claves conocidas, sin campos adicionales y con nombres limitados. Solo admins/editores pueden escribir un borrador no publicado; solo un admin puede poner `published: true`.

El nodo privado `schedules/<fecha>/<reunion>` requiere UID con `true` en `access/admins/<uid>` o `access/editors/<uid>`. Su escritura se deniega mientras la proyeccion correspondiente este publicada. `access` solo lo lee/modifica un admin, con lectura adicional de cada usuario autenticado a su propio nodo de rol. El diagnostico solo se permite en `diagnostics/connectionTest` para admins/editores y valida `ok`, `timestamp` ISO y `source`; no hay permisos en la rama padre.

Los permisos `.read` y `.write` se heredan a descendientes y no se restringen desde hijos mas profundos. Por eso no hay concesiones en `/`, `/publicData`, `/schedules` ni `/diagnostics`; las concesiones se ubican en las rutas concretas. `.validate` no concede acceso.

El primer admin debe crearse manualmente por el propietario: habilitar Email/Password en Firebase Authentication, crear su cuenta, obtener su UID e insertar `access/admins/<uid>: true` desde la consola con acceso de propietario. No se crean cuentas ni roles remotos desde esta aplicacion.

## Pruebas locales

`node scripts/validate-firebase-rules-proposal.mjs` verifica JSON, rutas y condiciones esperadas, pero no ejecuta el motor de reglas. La suite de `security-tests` usa identidades y datos sinteticos contra el emulador RTDB local; el proyecto `demo-...` evita servicios reales. El comando es:

```powershell
Set-Location security-tests
$env:FIREBASE_EMULATORS_PATH = Join-Path $PWD '.firebase-emulators'
$env:XDG_CONFIG_HOME = Join-Path $PWD '.test-config'
npm run test:emulator
```

El 30 de octubre de 2026, la suite del emulador paso 25 pruebas (0 fallos). Incluye lectura anonima de una proyeccion publicada, rechazo de lectura/escritura privada para visitantes, edicion privada por editores, publicacion exclusiva por administradores, rechazo de autoasignacion de roles, validacion de `updatedBy`, campos adicionales y bloqueo de la fuente mientras una vista esta publicada. La validacion estatica tambien paso. Esto no demuestra conexion ni reglas remotas.

La prueba remota queda pendiente de la configuracion del propietario y la aprobacion de reglas. No se debe publicar `database.rules.proposed.json` automaticamente ni abrir reglas de produccion para probar.

## Riesgo pendiente para la siguiente fase

El guardado de una programacion privada y la sincronizacion de `publicData` siguen siendo dos transacciones separadas de RTDB. Si la primera se confirma y la segunda falla, la fuente privada queda guardada mientras la proyeccion publica puede permanecer desfasada o no publicada. La interfaz informa el fallo y permite reintentar; evaluar una estrategia de consistencia/reintentos es trabajo separado. No se modifico el codigo de la aplicacion en esta fase.

Para retirar la pagina diagnostica local se eliminan `firebase-diagnostics.html` y `src/firebase-diagnostics.js`; la propuesta y sus pruebas se pueden conservar. No se deben borrar datos de `localStorage`.
