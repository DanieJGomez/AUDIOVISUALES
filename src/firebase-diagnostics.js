import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuthState,
} from './auth.js';
import { readData, writeData } from './database.js';

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
    const value = await readData(TEST_PATH);
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
    await writeData(TEST_PATH, payload);
    log(`Escritura remota correcta: ${JSON.stringify(payload)}`);
  } catch (error) {
    log(`Escritura remota rechazada: ${describeError(error)}`);
  }
});

$('deleteTest').addEventListener('click', async () => {
  if (!confirm('¿Borrar solo el nodo diagnostics/connectionTest?')) {
    return;
  }

  log('Borrando nodo de diagnóstico...');

  try {
    await writeData(TEST_PATH, null);
    log('Nodo de diagnóstico borrado.');
  } catch (error) {
    log(`No se pudo borrar el nodo: ${describeError(error)}`);
  }
});
