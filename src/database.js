import {
  onValue,
  ref,
  get,
  set,
  runTransaction,
  update,
} from 'firebase/database';
import { db } from './firebase.js';

export async function readData(path) {
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
}

export function writeData(path, value) {
  return set(ref(db, path), value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function writeDataIfUnchanged(path, value, expectedValue) {
  const expected = JSON.stringify(stableValue(expectedValue));
  return runTransaction(ref(db, path), (currentValue) => {
    if (JSON.stringify(stableValue(currentValue)) !== expected) return undefined;
    return value;
  }, { applyLocally: false });
}

export function updateData(path, values) {
  return update(ref(db, path), values);
}

export function subscribeToData(path, callback, onError) {
  return onValue(ref(db, path), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  }, onError);
}

export function subscribeToConnection(callback, onError) {
  return onValue(ref(db, '.info/connected'), (snapshot) => {
    callback(snapshot.val() === true);
  }, onError);
}
