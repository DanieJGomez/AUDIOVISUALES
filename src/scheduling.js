import {
  readData,
  subscribeToData,
  writeData,
} from './database.js';

const validMeetings = new Set(['first', 'second']);

function schedulePath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!validMeetings.has(meeting)) {
    throw new TypeError('La reunión debe ser "first" o "second".');
  }
  return `schedules/${date}/${meeting}`;
}

export function getSchedule(date, meeting) {
  return readData(schedulePath(date, meeting));
}

export function saveSchedule(date, meeting, schedule) {
  return writeData(schedulePath(date, meeting), schedule);
}

export function subscribeToSchedule(date, meeting, callback, onError) {
  return subscribeToData(schedulePath(date, meeting), callback, onError);
}