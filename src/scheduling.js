import {
  readData,
  subscribeToData,
  writeData,
} from './database.js';
import { MEETING_IDS, isMeetingId } from './meetings.js';

function schedulePath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!isMeetingId(meeting)) {
    throw new TypeError(`La reunión debe ser una de: ${MEETING_IDS.join(', ')}.`);
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