import {
  readData,
  subscribeToData,
  writeData,
} from './database.js';

const validMeetings = new Set(['first', 'second']);

function assignmentsPath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!validMeetings.has(meeting)) {
    throw new TypeError('La reunión debe ser "first" o "second".');
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