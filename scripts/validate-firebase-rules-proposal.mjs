import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [liveText, proposedText, firebaseText, diagnosticText] = await Promise.all([
  readFile(new URL('../database.rules.json', import.meta.url), 'utf8'),
  readFile(new URL('../database.rules.proposed.json', import.meta.url), 'utf8'),
  readFile(new URL('../firebase.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/firebase-diagnostics.js', import.meta.url), 'utf8'),
]);

const live = JSON.parse(liveText).rules;
const rules = JSON.parse(proposedText).rules;
const firebase = JSON.parse(firebaseText);

assert.equal(live['.read'], false, 'The deployed rules file must deny root reads.');
assert.equal(live['.write'], false, 'The deployed rules file must deny root writes.');
assert.deepEqual(Object.keys(live).sort(), ['.read', '.write'], 'The active rules file stays deny-all.');
assert.equal(firebase.database.rules, 'database.rules.json', 'Deploy must not point at the proposal.');
assert.equal(rules['.read'], false, 'The proposed root must deny reads.');
assert.equal(rules['.write'], false, 'The proposed root must deny writes.');
assert.equal(JSON.stringify(rules).includes('numChildren'), false, 'Use only verified RTDB rule methods.');
assert.deepEqual(Object.keys(rules).sort(), ['.read', '.write', 'access', 'diagnostics', 'publicData', 'schedules']);
assert.equal(rules.publicData['.read'], undefined, 'The publicData parent must not expose undeclared children.');
assert.deepEqual(Object.keys(rules.publicData), ['schedules']);
const publicProjection = rules.publicData.schedules.$date.$meeting;
assert.deepEqual(Object.keys(publicProjection).sort(), ['$other', '.read', '.validate', '.write', 'assignments', 'published']);
assert.ok(publicProjection['.read'].includes("data.child('published').val() === true"));
assert.ok(publicProjection['.read'].includes('access/editors'));
assert.ok(publicProjection['.write'].includes("newData.child('published').val() === false"));
assert.ok(publicProjection['.write'].includes('access/admins'));
assert.equal(publicProjection['.validate'].includes("newData.child('notes')"), false);
assert.equal(publicProjection.$other['.validate'], false);
assert.ok(publicProjection['.validate'].includes("newData.hasChildren(['published'])"));
assert.ok(publicProjection['.validate'].includes("root.child('schedules').child($date).child($meeting)"));
assert.equal(publicProjection.published['.validate'], 'newData.isBoolean()');
assert.equal(publicProjection.assignments.$other['.validate'], false);
assert.deepEqual(Object.keys(publicProjection.assignments).sort(), [
  '$other', '.validate', 'camera1', 'camera2', 'lyrics', 'mainCamera', 'photo', 'stageFirst', 'stageSermon',
].sort());
for (const role of Object.keys(publicProjection.assignments).filter((key) => !key.startsWith('$') && !key.startsWith('.'))) {
  assert.ok(publicProjection.assignments[role]['.validate'].includes('newData.isString()'));
}
const privateScheduleRule = rules.schedules.$date.$meeting;
assert.ok(privateScheduleRule['.read'].includes('auth != null'), 'Raw schedules stay private.');
assert.ok(privateScheduleRule['.write'].includes('access/admins'));
assert.ok(privateScheduleRule['.write'].includes('access/editors'));
assert.ok(privateScheduleRule['.write'].includes('newData.exists()'), 'Private schedule deletion must be rejected.');
assert.ok(privateScheduleRule['.write'].includes("child('published').val() !== true"));
assert.ok(privateScheduleRule['.write'].includes("$date.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"));
assert.equal(privateScheduleRule.$other['.validate'], false, 'Unknown private schedule fields must be rejected.');
assert.ok(privateScheduleRule['.validate'].includes("newData.hasChildren(['arrival', 'dress', 'dressColor', 'notes', 'updatedAt', 'updatedBy'])"));
assert.equal(privateScheduleRule.updatedBy['.validate'], "newData.isString() && newData.val() === auth.uid");
assert.ok(privateScheduleRule.updatedAt['.validate'].includes('.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T'));
assert.equal(privateScheduleRule.assignments.$other['.validate'], false);
assert.ok(privateScheduleRule.people.$index['.validate'].includes('/^(0|[1-9]|[1-9][0-9])$/'));
assert.equal(privateScheduleRule.people.$index['.validate'].includes("newData.isString()"), true);
assert.equal(privateScheduleRule.tasks.$index.$other['.validate'], false);
assert.ok(privateScheduleRule.tasks.$index['.validate'].includes('/^(0|[1-9]|[1-9][0-9])$/'));
assert.equal(privateScheduleRule.tasks.$index.completed['.validate'], 'newData.isBoolean()');
assert.equal(privateScheduleRule.tasks.$index.text['.validate'].includes('newData.isString()'), true);
assert.equal(privateScheduleRule.tasks.$index.assignee['.validate'].includes('newData.isString()'), true);
assert.ok(rules.access['.read'].includes('access/admins'));
assert.equal(rules.access['.write'], undefined, 'Role writes must be limited to declared role paths.');
assert.ok(rules.access.admins.$uid['.read'].includes('auth.uid === $uid'));
assert.ok(rules.access.editors.$uid['.read'].includes('auth.uid === $uid'));
for (const roleName of ['admins', 'editors']) {
  const roleRule = rules.access[roleName].$uid;
  assert.ok(roleRule['.write'].includes('access/admins'));
  assert.ok(roleRule['.write'].includes('auth.uid !== $uid'), 'A user cannot modify their own role.');
  assert.equal(roleRule['.validate'], 'newData.isBoolean()');
}
assert.equal(rules.access.admins.$other, undefined);
assert.equal(publicProjection.$other['.validate'], false, 'Unknown public projection fields must be rejected.');
assert.ok(publicProjection['.validate'].includes("newData.hasChildren(['published'])"));
assert.equal(rules.diagnostics['.read'], undefined, 'No read grant at diagnostics parent.');
assert.equal(rules.diagnostics['.write'], undefined, 'No write grant at diagnostics parent.');
assert.deepEqual(Object.keys(rules.diagnostics), ['connectionTest']);
assert.deepEqual(Object.keys(rules.diagnostics.connectionTest).sort(), [
  '$other', '.read', '.validate', '.write', 'ok', 'source', 'timestamp',
]);
assert.equal(rules.diagnostics.connectionTest.ok['.validate'], true);
assert.equal(rules.diagnostics.connectionTest.timestamp['.validate'], true);
assert.equal(rules.diagnostics.connectionTest.source['.validate'], true);
assert.equal(rules.diagnostics.connectionTest.$other['.validate'], false);

const adminRule = "root.child('access/admins').child(auth.uid).val() === true";
const editorRule = "root.child('access/editors').child(auth.uid).val() === true";
const diagnostic = rules.diagnostics.connectionTest;
for (const operation of ['.read', '.write']) {
  assert.ok(diagnostic[operation].includes('auth != null'));
  assert.ok(diagnostic[operation].includes(adminRule));
  assert.ok(diagnostic[operation].includes(editorRule));
}

const validation = diagnostic['.validate'];
for (const clause of [
  "newData.hasChildren(['ok', 'timestamp', 'source'])",
  "newData.child('ok').isBoolean()",
  "newData.child('ok').val() === true",
  "newData.child('timestamp').isString()",
  "newData.child('timestamp').val().length > 0",
  "newData.child('timestamp').val().length <= 24",
  'newData.child(\'timestamp\').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/)',
  "newData.child('source').isString()",
  "newData.child('source').val() === 'firebase-diagnostics'",
]) {
  assert.ok(validation.includes(clause), `Missing validation condition: ${clause}`);
}
assert.equal(diagnostic.$other['.validate'], false, 'Extra fields must be rejected.');
assert.ok(!validation.includes('numChildren'), 'Do not use unverified rule language functions.');
assert.ok(diagnosticText.includes('timestamp: new Date().toISOString()'));
assert.match(new Date().toISOString(), /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/);
assert.equal(new Date().toISOString().length, 24);

console.log('OK: JSON parses; proposal structure and guards match; generated ISO timestamp fits the proposed format; deploy still uses deny-all rules.');
console.log('This static check does not evaluate authorization with the Firebase Rules engine.');
