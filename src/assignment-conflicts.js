export function findAssignmentConflicts(assignments, roles) {
  const assignedByPerson = new Map();
  const conflicts = [];

  for (const role of roles) {
    const rawPerson = assignments?.[role.id];
    if (typeof rawPerson !== 'string') continue;
    const person = rawPerson.trim().replace(/\s+/g, ' ');
    if (!person) continue;

    const key = person.normalize('NFKC').toLocaleLowerCase('es-CO');
    const segment = role.segment === 'worship' || role.segment === 'sermon'
      ? role.segment
      : 'full';
    const previousRoles = assignedByPerson.get(key) || [];

    for (const previous of previousRoles) {
      if (segment === 'full' || previous.segment === 'full' || segment === previous.segment) {
        conflicts.push({ person, firstRole: previous.name, secondRole: role.name });
      }
    }

    previousRoles.push({ name: role.name, segment });
    assignedByPerson.set(key, previousRoles);
  }

  return conflicts;
}

// Each item is one date + meeting. Conflicts never cross those service boundaries.
export function findScheduleAssignmentConflicts(schedules, roles) {
  return schedules.flatMap(({ date, meeting, assignments }) =>
    findAssignmentConflicts(assignments, roles).map((conflict) => ({
      ...conflict,
      date,
      meeting,
    }))
  );
}
