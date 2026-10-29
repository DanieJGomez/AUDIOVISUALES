import {
  readData,
  subscribeToData,
  writeDataIfUnchanged,
} from './database.js';
import { MEETING_IDS, isMeetingId } from './meetings.js';

const PUBLIC_ASSIGNMENT_KEYS = [
  'mainCamera', 'camera1', 'camera2', 'photo', 'lyrics',
  'stageFirst', 'stageSermon',
];

function schedulePath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!isMeetingId(meeting)) {
    throw new TypeError(`La reunión debe ser una de: ${MEETING_IDS.join(', ')}.`);
  }
  return `schedules/${date}/${meeting}`;
}

function publicSchedulePath(date, meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('La fecha debe tener el formato YYYY-MM-DD.');
  }
  if (!isMeetingId(meeting)) {
    throw new TypeError(`La reunión debe ser una de: ${MEETING_IDS.join(', ')}.`);
  }
  return `publicData/schedules/${date}/${meeting}`;
}

export function createScheduleProjection(schedule, published = false) {
  const source = schedule?.assignments && typeof schedule.assignments === 'object'
    ? schedule.assignments
    : {};
  const assignments = Object.fromEntries(
    PUBLIC_ASSIGNMENT_KEYS
      .filter((key) => typeof source[key] === 'string')
      .map((key) => [key, source[key]])
  );
  return { published: published === true, assignments };
}

export function getSchedule(date, meeting) {
  return readData(schedulePath(date, meeting));
}

export function saveScheduleIfUnchanged(date, meeting, schedule, baseline) {
  return writeDataIfUnchanged(schedulePath(date, meeting), schedule, baseline);
}

export function subscribeToSchedule(date, meeting, callback, onError) {
  return subscribeToData(schedulePath(date, meeting), callback, onError);
}

export function subscribeToPublicSchedule(date, meeting, callback, onError) {
  return subscribeToData(publicSchedulePath(date, meeting), callback, onError);
}

export function saveScheduleProjectionIfUnchanged(date, meeting, schedule, baseline) {
  return writeDataIfUnchanged(
    publicSchedulePath(date, meeting),
    createScheduleProjection(schedule, false),
    baseline
  );
}

export function publishScheduleProjectionIfUnchanged(date, meeting, schedule, baseline) {
  return writeDataIfUnchanged(
    publicSchedulePath(date, meeting),
    createScheduleProjection(schedule, true),
    baseline
  );
}
