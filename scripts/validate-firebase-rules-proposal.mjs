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
assert.equal(firebase.database.rules, 'database.rules.json', 'Deploy must not point at the proposal.');
assert.equal(rules['.read'], false, 'The proposed root must deny reads.');
assert.equal(rules['.write'], false, 'The proposed root must deny writes.');
assert.deepEqual(Object.keys(rules).sort(), ['.read', '.write', 'access', 'diagnostics', 'publicData']);
assert.equal(rules.publicData['.read'], true, 'Only publicData gets public read access.');
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
