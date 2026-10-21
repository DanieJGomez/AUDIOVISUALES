import {
  readData,
  subscribeToData,
  writeData,
} from './database.js';

const MAP_PATH = 'venueMap';

export function getMap() {
  return readData(MAP_PATH);
}

export function saveMap(mapData) {
  return writeData(MAP_PATH, mapData);
}

export function subscribeToMap(callback, onError) {
  return subscribeToData(MAP_PATH, callback, onError);
}