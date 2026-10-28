# Prueba controlada de Firebase

## Estado actual

La configuración cliente local contiene un `databaseURL` para el proyecto
`cmb-audiovisuales`, y el código incluye el SDK de Realtime Database y Google
Authentication. Esto solo confirma la configuración escrita en el repositorio;
no confirma que Realtime Database esté provisionada, que Google esté habilitado
en Authentication ni que el dominio local esté autorizado.

Las reglas locales de `database.rules.json` niegan toda lectura y escritura. No
se modificaron ni publicaron reglas. La página `firebase-diagnostics.html` y su
módulo `src/firebase-diagnostics.js` ya existían como cambios locales sin commit;
se dejaron intactos. El módulo reemplaza el valor de `diagnostics/connectionTest`
al escribir y permite borrar ese nodo. Úsalo únicamente cuando el nodo esté vacío
o su contenido sea prescindible. No pongas información personal allí.

## Reglas propuestas para revisar

Estas reglas son una propuesta de diseño, no están aplicadas. Mantienen denegado
el acceso en la raíz y otorgan permisos únicamente en ramas explícitas:

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
      ".read": "auth != null && (root.child('access/admins').child(auth.uid).val() === true || root.child('access/editors').child(auth.uid).val() === true)",
      ".write": "auth != null && (root.child('access/admins').child(auth.uid).val() === true || root.child('access/editors').child(auth.uid).val() === true)",
      "connectionTest": {
        ".validate": "newData.hasChildren(['ok', 'timestamp', 'source']) && newData.child('ok').val() === true && newData.child('source').val() === 'firebase-diagnostics'"
      }
    }
  }
}
```

Efectos y límites:

- Cualquier cliente puede leer `publicData`. Esa rama debe contener solo datos
  expresamente públicos; `access` y `diagnostics` no quedan incluidos en ella.
- Solo UID con valor booleano `true` en `access/admins/<uid>` o
  `access/editors/<uid>` puede leer/escribir `publicData` y el diagnóstico.
- Solo administradores pueden leer o cambiar `access`, evitando que un editor
  se conceda permisos a sí mismo. La siembra inicial de `access/admins/<uid>` debe
  hacerse mediante la consola o el SDK Admin desde un entorno confiable.
- La validación restringe la forma básica del registro de diagnóstico. Las
  reglas no comprueban que el timestamp sea reciente ni reemplazan la validación
  del cliente. Puede hacerse más estricta si se requiere.
- Estas reglas no conceden acceso a las rutas heredadas `schedules`, `assignments`
  u otras. Deben modelarse y revisarse antes de migrar la aplicación.
- Los permisos de Realtime Database se acumulan: una concesión amplia en un
  ancestro o una regla `.write` existente puede invalidar este aislamiento.
  Revisar el árbol completo de reglas antes de publicar.

## Pasos del propietario antes de la prueba remota

1. En Firebase Console, confirmar que el proyecto `cmb-audiovisuales` tiene
   Realtime Database creada y verificar su URL/región.
2. En Authentication, confirmar que Google está habilitado y que los dominios
   de prueba (`localhost` o el host local elegido) están autorizados.
3. Revisar las reglas completas en modo de prueba/simulador, adaptarlas al árbol
   de datos real y aprobar explícitamente cualquier publicación. No publicar
   las reglas propuestas desde este repositorio sin esa revisión.
4. Iniciar sesión en la página diagnóstica local y copiar el UID mostrado.
   Autorizar ese UID como editor mediante un administrador de forma confiable.
   No confiar en el estado de botones de la interfaz como control de acceso.
5. Confirmar que `diagnostics/connectionTest` no contiene información que deba
   conservarse. Ejecutar `npm run dev`, abrir `/firebase-diagnostics.html`, leer
   el nodo, escribir la marca de prueba y volver a leerla para comprobar el valor.
   La interfaz actual informa el éxito de la escritura a partir de la promesa de
   `set`; para confirmar persistencia, usar también la lectura posterior.
6. Al terminar, borrar solo `diagnostics/connectionTest` desde la página o la
   consola y verificar que queda ausente. Revocar el UID temporal si ya no debe
   editar datos.

En el estado actual no se puede ejecutar la prueba remota desde el entorno: no
está disponible Firebase CLI ni hay sesión/configuración de credenciales de
propietario. No se ha confirmado lectura ni escritura remota. No se necesita una
clave de servidor para el flujo descrito.

## Retirada

La página diagnóstica no se referencia desde la aplicación principal y no debe
publicarse. Para retirarla, borrar `firebase-diagnostics.html`,
`src/firebase-diagnostics.js` y este documento si ya no hacen falta, y borrar el
nodo remoto de diagnóstico. El contenido de `localStorage` no se modifica.
