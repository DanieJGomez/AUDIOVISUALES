import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuthState,
} from './auth.js';
import { get, ref, runTransaction } from 'firebase/database';
import { db } from './firebase.js';

const TEST_PATH = 'diagnostics/connectionTest';
const TEST_SOURCE = 'firebase-diagnostics';

const $ = (id) => document.getElementById(id);
const logElement = $('log');

function log(message) {
  const time = new Date().toLocaleTimeString('es-CO');
  logElement.textContent += `[${time}] ${message}\n`;
}

function describeError(error) {
  const details = [error?.code, error?.message].filter(Boolean);
  return details.length ? details.join(': ') : 'Error desconocido';
}

function setSignedIn(user) {
  $('authStatus').textContent = user
    ? `Sesión iniciada como ${user.email || 'usuario sin correo'} · UID: ${user.uid}`
    : 'Sin sesión iniciada.';
  $('signIn').disabled = Boolean(user);
  $('signOut').disabled = !user;
  $('writeTest').disabled = !user;
  $('deleteTest').disabled = !user;
}

subscribeToAuthState(setSignedIn);

$('signIn').addEventListener('click', async () => {
  log('Abriendo inicio de sesión con Google...');

  try {
    await signInWithGoogle();
    log('Inicio de sesión completado.');
  } catch (error) {
    log(`No se pudo iniciar sesión: ${describeError(error)}`);
  }
});

$('signOut').addEventListener('click', async () => {
  try {
    await signOutUser();
    log('Sesión cerrada.');
  } catch (error) {
    log(`No se pudo cerrar la sesión: ${describeError(error)}`);
  }
});

$('readTest').addEventListener('click', async () => {
  log('Leyendo nodo de diagnóstico...');

  try {
    const snapshot = await get(ref(db, TEST_PATH));
    const value = snapshot.exists() ? snapshot.val() : null;
    log(value === null
      ? 'Lectura remota correcta: el nodo está vacío.'
      : `Lectura remota correcta: ${JSON.stringify(value)}`);
  } catch (error) {
    log(`Lectura remota rechazada: ${describeError(error)}`);
  }
});

$('writeTest').addEventListener('click', async () => {
  const payload = {
    ok: true,
    timestamp: new Date().toISOString(),
    source: TEST_SOURCE,
  };

  log('Escribiendo nodo de diagnóstico...');

  try {
    const result = await runTransaction(ref(db, TEST_PATH), (current) => {
      // El diagnóstico nunca debe reemplazar un valor que ya exista.
      return current === null ? payload : undefined;
    });

    if (!result.committed) {
      log('Escritura cancelada: el nodo ya contiene datos y no se modificó.');
      return;
    }

    const verification = await get(ref(db, TEST_PATH));
    const storedValue = verification.exists() ? verification.val() : null;
    if (JSON.stringify(storedValue) !== JSON.stringify(payload)) {
      log('La transacción se confirmó, pero la lectura posterior no coincide con la marca escrita.');
      return;
    }

    log(`Escritura y lectura de comprobación correctas: ${JSON.stringify(storedValue)}`);
  } catch (error) {
    log(`Escritura remota rechazada: ${describeError(error)}`);
  }
});

$('deleteTest').addEventListener('click', async () => {
  if (!confirm('¿Borrar el nodo de prueba solo si aún contiene la marca firebase-diagnostics?')) {
    return;
  }

  log('Borrando nodo de diagnóstico...');

  try {
    const result = await runTransaction(ref(db, TEST_PATH), (current) => {
      return current?.source === TEST_SOURCE ? null : undefined;
    });

    if (result.committed) {
      log('Nodo de prueba borrado.');
    } else if (result.snapshot.exists()) {
      log('El nodo no contiene la marca de prueba esperada y no se modificó.');
    } else {
      log('El nodo ya estaba vacío.');
    }
  } catch (error) {
    log(`No se pudo borrar el nodo: ${describeError(error)}`);
  }
});
