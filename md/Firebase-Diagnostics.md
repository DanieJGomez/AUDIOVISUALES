# Reglas y prueba controlada de Firebase

## Estado local

`src/firebase.js` contiene una configuración cliente para el proyecto
`cmb-audiovisuales`, incluida una URL de Realtime Database. `src/auth.js`
implementa el flujo de Google Authentication. El código local confirma la
intención de configuración, pero no demuestra que Realtime Database exista, que
Google esté habilitado en Firebase Authentication ni que `localhost` esté
autorizado en la consola.

`database.rules.json`, el archivo que referencia `firebase.json`, conserva las
reglas seguras de denegación total. La propuesta está aislada en
[`database.rules.proposed.json`](../database.rules.proposed.json) y no se ha
publicado. No apuntes `firebase.json` a ese borrador ni lo despliegues sin una
revisión y aprobación explícitas.

La página `firebase-diagnostics.html` escribe en
`diagnostics/connectionTest` mediante una transacción que solo crea el nodo si
está vacío, luego relee y compara el valor. La eliminación solo actúa si
`source` sigue siendo `firebase-diagnostics`.

## Propuesta de reglas

El borrador completo está en `database.rules.proposed.json`:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "publicData": {
      ".read": true,
      ".write": "auth != null && (root.child('access/admins').child(auth.uid).val() === true || root.child('access/editors').child(auth.uid).val() === true)"
    },
    "access": {
      ".read": "auth != null && root.child('access/admins').child(auth.uid).val() === true",
      ".write": "auth != null && root.child('access/admins').child(auth.uid).val() === true"
    },
    "diagnostics": {
      "connectionTest": {
        ".read": "auth != null && (root.child('access/admins').child(auth.uid).val() === true || root.child('access/editors').child(auth.uid).val() === true)",
        ".write": "auth != null && (root.child('access/admins').child(auth.uid).val() === true || root.child('access/editors').child(auth.uid).val() === true)",
        ".validate": "newData.hasChildren(['ok', 'timestamp', 'source']) && newData.child('ok').isBoolean() && newData.child('ok').val() === true && newData.child('timestamp').isString() && newData.child('timestamp').val().length > 0 && newData.child('timestamp').val().length <= 24 && newData.child('timestamp').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/) && newData.child('source').isString() && newData.child('source').val() === 'firebase-diagnostics'",
        "ok": { ".validate": true },
        "timestamp": { ".validate": true },
        "source": { ".validate": true },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
```

### Qué autoriza

- En la raíz, `.read: false` y `.write: false` deniegan operaciones en la raíz.
  No se definen permisos para `schedules`, `assignments` ni otras rutas antiguas;
  esas rutas siguen denegadas hasta un diseño posterior.
- `publicData` es la única rama con lectura pública. Debe almacenar únicamente
  información apta para cualquier visitante. Administradores y editores
  autenticados pueden escribir en esa rama.
- `access` solo puede leerse o escribirse con un UID autenticado cuya entrada en
  `access/admins/<uid>` sea exactamente `true`. Los editores no pueden cambiar su
  propio rol ni conceder acceso a otros.
- Solo `diagnostics/connectionTest` recibe permisos de lectura y escritura. Se
  requiere un usuario autenticado y que su UID tenga valor booleano `true` en
  `access/admins/<uid>` o `access/editors/<uid>`.
- La validación requiere exactamente tres campos: `ok` booleano con valor `true`,
  `timestamp` string no vacío de hasta 24 caracteres con formato ISO UTC
  `YYYY-MM-DDTHH:mm:ss.sssZ`, y `source` string exactamente igual a
  `firebase-diagnostics`. Las tres claves válidas están declaradas como hijos
  estáticos; el comodín `"$other"` con `.validate: false` rechaza cualquier otro
  campo. Ese formato coincide con `new Date().toISOString()`
  usado por `src/firebase-diagnostics.js` para fechas dentro del rango habitual
  de cuatro dígitos de año.
- Realtime Database no evalúa `.validate` al borrar (`newData` nulo). Por tanto,
  la validación de forma no impide eliminar el registro; el `.write` de
  `connectionTest` sigue exigiendo autenticación y UID autorizado.

### Herencia de permisos

En Realtime Database, un `.read` o `.write` concedido en un nodo también autoriza
esa operación en sus descendientes y no puede ser revocado por una regla más
profunda. Por eso la propuesta no concede lectura/escritura en `/` ni en
`/diagnostics`: los permisos diagnósticos están en `/diagnostics/connectionTest`.
Una concesión en `/publicData` se limita a esa rama. Una concesión de escritura
en `/access` es amplia dentro de esa rama, pero únicamente para administradores.
Las reglas de `.validate` no conceden acceso y no se heredan; validan los datos
no nulos en la ruta donde están declaradas.

El patrón `"$other"` para rechazar claves adicionales y la excepción de
validación al borrar están descritos en la documentación oficial de Firebase
([reglas de Realtime Database](https://firebase.google.com/docs/database/security/rules-conditions)).

Al publicar, hay que revisar el árbol completo: una regla permisiva existente en
un ancestro puede anular este aislamiento. Estas reglas no se han cargado en un
emulador ni en Firebase Console, así que la explicación no equivale a una
validación ejecutada por el motor de reglas.

## Condiciones para crear el primer administrador

La regla de `access` requiere que ya exista un administrador, por lo que no puede
usarse para crear el primero desde una sesión cliente normal. Antes de conceder
el rol inicial deben cumplirse estas condiciones:

1. El propietario confirma el proyecto Firebase y la instancia de Realtime
   Database correctos.
2. Google Authentication está habilitado y el propietario inicia sesión con la
   cuenta que desea autorizar, para obtener su UID exacto. La autenticación del
   cliente por sí sola no concede permisos.
3. El propietario accede a la base de datos mediante un canal de confianza con
   privilegios administrativos y crea `access/admins/<UID>` con el valor booleano
   `true`. La consola Firebase autenticada es una opción; también puede usarse el
   SDK Admin desde un entorno seguro.
4. Si se usa el SDK Admin, las credenciales de servicio deben permanecer fuera del
   navegador, del repositorio y de los registros. No se debe crear ni compartir
   una clave de servidor para esta prueba.
5. Verificar la entrada inicial y luego probar que un usuario no autorizado no
   puede leer/escribir `access` ni `diagnostics/connectionTest`.

Este repositorio no ha creado un administrador remoto. Un error al escoger
proyecto o UID puede conceder privilegios a la cuenta equivocada.

## Pruebas locales ejecutables y límites

Ejecutar `node scripts/validate-firebase-rules-proposal.mjs` comprueba que ambos
JSON parsean, que el deploy sigue apuntando a la regla local deny-all, y que la
estructura y las expresiones requeridas aparecen en los nodos esperados. Esto es
una comprobación estática; no interpreta las reglas. También se ejecutó la suite
contra el emulador real de Realtime Database usando identidades y datos
sintéticos.

Resultados ejecutados con el emulador:

| Caso | Resultado real |
| --- | --- |
| Sin autenticar: leer/escribir diagnóstico | Pasó: ambas operaciones denegadas |
| Autenticado sin rol: leer/escribir diagnóstico | Pasó: ambas operaciones denegadas |
| Editor: crear, leer y borrar registro válido | Pasó |
| Admin: leer/escribir `access` | Pasó |
| Editor: leer/escribir `access` | Pasó: ambas operaciones denegadas |
| Anónimo: leer/escribir `publicData` | Pasó: lectura permitida, escritura denegada |
| Editor: escribir `publicData` | Pasó |
| Diagnóstico inválido: campo faltante/adicional, `ok` inválido, `source` incorrecto | Pasó: escrituras denegadas |
| Diagnóstico inválido: timestamp vacío, mayor de 24 caracteres o formato incorrecto | Pasó: escrituras denegadas |

La suite reportó 16 pruebas (incluye los subcasos de registros inválidos), 16
pasaron y 0 fallaron. Para ejecutarla desde la raíz:

```powershell
cd security-tests
npm ci
$env:XDG_CONFIG_HOME = Join-Path $env:TEMP 'cmb-rtdb-firebase-config'
$env:FIREBASE_EMULATORS_PATH = Join-Path $env:TEMP 'cmb-rtdb-firebase-emulators'
npm run test:emulator
```

El arnés aislado probado usa Firebase CLI 14.27.0, Firebase SDK 12.19.0 y
`@firebase/rules-unit-testing` 5.0.2 por la compatibilidad de versiones; no
cambia las dependencias de la aplicación, que sigue con Firebase 13.
`firebase.emulator.json` es solo configuración local del
emulador y carga `database.rules.proposed.json`. El proyecto `demo-...` evita
conexiones a servicios reales. La primera ejecución puede descargar el JAR del
emulador; Firebase CLI puede mostrar un aviso de MOTD sin afectar la prueba.
La instalación reportó 19 avisos de vulnerabilidad en el árbol aislado de
herramientas; no ejecuté actualizaciones automáticas. Revisar con
`npm audit --prefix security-tests` antes de reutilizar estas herramientas.

Durante las pruebas se corrigió la regla `$other`: para que solo capture claves
desconocidas, `ok`, `timestamp` y `source` deben declararse también como hijos
estáticos. Con esa corrección se aceptó el registro válido y se rechazaron los
inválidos.

La prueba remota requiere además confirmar en Firebase Console que Realtime
Database existe, Google Authentication está habilitado y el dominio local está
autorizado. No se confirmó ninguna lectura ni escritura remota. No hay que abrir
lectura/escritura global, habilitar facturación ni migrar `localStorage` para
revisar esta propuesta.

`database.rules.json` sigue con `.read: false` y `.write: false`; Firebase CLI no
publicó reglas ni se conectó a una instancia remota.

## Retirar la prueba

Al terminar la verificación remota, borrar únicamente
`diagnostics/connectionTest`, comprobar que está vacío y retirar la autorización
temporal si corresponde. Para retirar el código local, borrar
`firebase-diagnostics.html` y `src/firebase-diagnostics.js`. Mantener o eliminar
el borrador de reglas según la decisión del propietario; nunca desplegarlo por
accidente. Los datos de `localStorage` no se modifican.
