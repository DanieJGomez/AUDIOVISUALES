import {
  onValue,
  ref,
  get,
  set,
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

export function updateData(path, values) {
  return update(ref(db, path), values);
}

export function subscribeToData(path, callback, onError) {
  return onValue(ref(db, path), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  }, onError);
}