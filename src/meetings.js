export const MEETINGS = Object.freeze([
  Object.freeze({ id: 'first', label: 'Primera reunión' }),
  Object.freeze({ id: 'second', label: 'Segundo servicio' }),
  Object.freeze({ id: 'fasting', label: 'Ayuno' }),
  Object.freeze({ id: 'worship', label: 'Culto' }),
  Object.freeze({ id: 'vigil', label: 'Vigilia' }),
]);

export const MEETING_IDS = Object.freeze(MEETINGS.map(({ id }) => id));

const meetingLabels = Object.freeze(
  Object.fromEntries(MEETINGS.map(({ id, label }) => [id, label]))
);

const validMeetings = new Set(MEETING_IDS);

export function isMeetingId(value) {
  return validMeetings.has(value);
}

export function getMeetingLabel(value) {
  return meetingLabels[value] || value;
}
