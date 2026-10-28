import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, set } from 'firebase/database';

const PROJECT_ID = 'demo-cmb-audiovisual-security';
const TEST_PATH = 'diagnostics/connectionTest';
const VALID_RECORD = {
  ok: true,
  timestamp: '2026-10-28T18:04:05.123Z',
  source: 'firebase-diagnostics',
};

let testEnv;

before(async () => {
  const rulesText = await readFile(new URL('../database.rules.proposed.json', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      host: '127.0.0.1',
      port: 9100,
      rules: rulesText,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database()), {
      access: {
        admins: { 'admin-1': true },
        editors: { 'editor-1': true },
      },
      publicData: { welcome: 'public fixture' },
    });
  });
});

test('unauthenticated user cannot read or write the diagnostic node', async () => {
  const db = testEnv.unauthenticatedContext().database();
  await assertFails(get(ref(db, TEST_PATH)));
  await assertFails(set(ref(db, TEST_PATH), VALID_RECORD));
});

test('authenticated user without an access entry cannot read or write the diagnostic node', async () => {
  const db = testEnv.authenticatedContext('outsider-1').database();
  await assertFails(get(ref(db, TEST_PATH)));
  await assertFails(set(ref(db, TEST_PATH), VALID_RECORD));
});

test('authorized editor can create, read, and delete the diagnostic record', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  const recordRef = ref(db, TEST_PATH);

  await assertSucceeds(set(recordRef, VALID_RECORD));
  const stored = await assertSucceeds(get(recordRef));
  assert.deepEqual(stored.val(), VALID_RECORD);
  await assertSucceeds(remove(recordRef));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const deleted = await get(ref(context.database(), TEST_PATH));
    assert.equal(deleted.exists(), false);
  });
});

test('authorized administrator can read and modify access', async () => {
  const db = testEnv.authenticatedContext('admin-1').database();
  const accessRef = ref(db, 'access/editors/editor-2');
  await assertSucceeds(set(accessRef, true));
  const result = await assertSucceeds(get(accessRef));
  assert.equal(result.val(), true);
});

test('authorized editor cannot read or modify access', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  await assertFails(get(ref(db, 'access')));
  await assertFails(set(ref(db, 'access/editors/editor-2'), true));
});

test('unauthenticated user can read but cannot write publicData', async () => {
  const db = testEnv.unauthenticatedContext().database();
  const publicRef = ref(db, 'publicData/welcome');
  const result = await assertSucceeds(get(publicRef));
  assert.equal(result.val(), 'public fixture');
  await assertFails(set(ref(db, 'publicData/attacker'), 'nope'));
});

test('authorized editor can write publicData', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  const valueRef = ref(db, 'publicData/editorValue');
  await assertSucceeds(set(valueRef, 'approved'));
  const result = await assertSucceeds(get(valueRef));
  assert.equal(result.val(), 'approved');
});

test('invalid diagnostic records are rejected', async (t) => {
  const invalidRecords = [
    ['missing source', { ok: true, timestamp: VALID_RECORD.timestamp }],
    ['extra field', { ...VALID_RECORD, extra: 'nope' }],
    ['ok false', { ...VALID_RECORD, ok: false }],
    ['ok wrong type', { ...VALID_RECORD, ok: 'true' }],
    ['source mismatch', { ...VALID_RECORD, source: 'other' }],
    ['timestamp empty', { ...VALID_RECORD, timestamp: '' }],
    ['timestamp too long', { ...VALID_RECORD, timestamp: `${VALID_RECORD.timestamp}x` }],
    ['timestamp malformed', { ...VALID_RECORD, timestamp: 'not-a-date' }],
  ];

  const db = testEnv.authenticatedContext('editor-1').database();
  for (const [name, record] of invalidRecords) {
    await t.test(name, async () => {
      await assertFails(set(ref(db, TEST_PATH), record));
    });
  }
});
