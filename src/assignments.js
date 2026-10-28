import {
  readData,
  subscribeToData,
  writeData,
} from './database.js';
import { MEETING_IDS, isMeetingId } from './meetings.js';

function assignmentsPath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!isMeetingId(meeting)) {
    throw new TypeError(`La reunión debe ser una de: ${MEETING_IDS.join(', ')}.`);
  }
  return `schedules/${date}/${meeting}/assignments`;
}

function assignmentPath(date, meeting, roleId) {
  if (!/^[A-Za-z0-9_-]+$/.test(roleId)) {
    throw new TypeError('El identificador del puesto no es válido.');
  }
  return `${assignmentsPath(date, meeting)}/${roleId}`;
}

export function getAssignments(date, meeting) {
  return readData(assignmentsPath(date, meeting));
}

export function saveAssignment(date, meeting, roleId, person) {
  return writeData(assignmentPath(date, meeting, roleId), person || null);
}

export function subscribeToAssignments(date, meeting, callback, onError) {
  return subscribeToData(assignmentsPath(date, meeting), callback, onError);
}