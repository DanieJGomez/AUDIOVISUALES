import {
  onValue,
  ref,
  get,
  set,
  update,
} from 'firebase/database';
import { database } from './firebase.js';

export async function readData(path) {
  const snapshot = await get(ref(database, path));
  return snapshot.exists() ? snapshot.val() : null;
}

export function writeData(path, value) {
  return set(ref(database, path), value);
}

export function updateData(path, values) {
  return update(ref(database, path), values);
}

export function subscribeToData(path, callback, onError) {
  return onValue(ref(database, path), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  }, onError);
}