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
        editors: { 'editor-1': true, 'editor-2': true },
      },
      publicData: {
        schedules: {
          '2026-10-25': {
            first: { published: true, assignments: { camera1: 'Server A' } },
            second: { published: false, assignments: { camera1: 'Server B' } },
          },
        },
      },
      schedules: {
        '2026-10-25': {
          first: { assignments: { camera1: 'Server A' }, notes: 'private note', updatedBy: 'editor-1' },
          second: { assignments: { camera1: 'Server B' }, notes: 'private note', updatedBy: 'editor-1' },
        },
      },
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

test('undeclared publicData branches stay inaccessible', async () => {
  const db = testEnv.unauthenticatedContext().database();
  await assertFails(get(ref(db, 'publicData/members')));
  await assertFails(set(ref(db, 'publicData/members/attacker'), 'nope'));
});

test('editor cannot write undeclared publicData branches', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  const valueRef = ref(db, 'publicData/members/editorValue');
  await assertFails(set(valueRef, 'approved'));
});

test('anonymous reader sees only the published schedule projection', async () => {
  const db = testEnv.unauthenticatedContext().database();
  const publicRef = ref(db, 'publicData/schedules/2026-10-25/first');
  await assertFails(get(ref(db, 'publicData')));
  await assertFails(get(ref(db, 'publicData/schedules/2026-10-25')));
  const snapshot = await assertSucceeds(get(publicRef));
  assert.deepEqual(snapshot.val(), { published: true, assignments: { camera1: 'Server A' } });
  assert.equal(Object.hasOwn(snapshot.val(), 'notes'), false);
  assert.equal(Object.hasOwn(snapshot.val(), 'updatedBy'), false);
  await assertFails(get(ref(db, 'publicData/schedules/2026-10-25/second')));
});

test('authorized editor can write an unpublished projection but cannot publish it', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  const projectionRef = ref(db, 'publicData/schedules/2026-10-25/second');
  const draft = { published: false, assignments: { camera1: 'Server C' } };
  await assertSucceeds(set(projectionRef, draft));
  const stored = await assertSucceeds(get(projectionRef));
  assert.deepEqual(stored.val(), draft);
  await assertFails(set(projectionRef, { ...draft, published: true }));
  for (const [field, value] of Object.entries({
    notes: 'private note',
    people: ['Private Name'],
    tasks: [{ text: 'private task' }],
    arrival: '07:00 AM',
    dress: 'private detail',
    dressColor: '#123456',
    updatedAt: '2026-10-25T00:00:00.000Z',
    updatedBy: 'editor-1',
    screens: 'Removed separate screen post',
    mixer: 'Removed separate image-mixing post',
  })) {
    await assertFails(set(projectionRef, { ...draft, [field]: value }));
  }
  await assertFails(set(projectionRef, { published: false, assignments: { phone: '555' } }));
  await assertSucceeds(set(projectionRef, { published: false, assignments: {} }));
  await assertFails(set(projectionRef, { assignments: { camera1: 'Missing publication flag' } }));
});

test('authenticated user without an editor role cannot read or write a draft projection', async () => {
  const db = testEnv.authenticatedContext('outsider-1').database();
  const projectionRef = ref(db, 'publicData/schedules/2026-10-25/second');
  await assertFails(get(projectionRef));
  await assertFails(set(projectionRef, { published: false, assignments: { camera1: 'Nope' } }));
});

test('administrator can publish the projection with the approved schema', async () => {
  const db = testEnv.authenticatedContext('admin-1').database();
  const projectionRef = ref(db, 'publicData/schedules/2026-10-25/second');
  await assertFails(set(projectionRef, { published: true, assignments: { camera1: 'Stale value' } }));
  await assertSucceeds(set(projectionRef, { published: true, assignments: { camera1: 'Server B' } }));
  const anonymous = testEnv.unauthenticatedContext().database();
  const published = await assertSucceeds(get(ref(anonymous, 'publicData/schedules/2026-10-25/second')));
  assert.deepEqual(published.val(), { published: true, assignments: { camera1: 'Server B' } });
});

test('raw schedules are not public and cannot be written by anonymous users', async () => {
  const db = testEnv.unauthenticatedContext().database();
  const scheduleRef = ref(db, 'schedules/2026-10-25/first');
  await assertFails(get(scheduleRef));
  await assertFails(set(scheduleRef, { title: 'attacker edit' }));
});

test('authorized editors share schedule data; users without roles cannot write', async () => {
  const editorOne = testEnv.authenticatedContext('editor-1').database();
  const editorTwo = testEnv.authenticatedContext('editor-2').database();
  const outsider = testEnv.authenticatedContext('outsider-1').database();
  const schedulePath = 'schedules/2026-10-25/second';
  await assertSucceeds(set(ref(editorOne, schedulePath), { assignments: { camera1: 'Server A' } }));
  const shared = await assertSucceeds(get(ref(editorTwo, schedulePath)));
  assert.deepEqual(shared.val(), { assignments: { camera1: 'Server A' } });
  await assertFails(set(ref(outsider, schedulePath), { assignments: {} }));
});

test('a published projection locks its private source until it is unpublished', async () => {
  const editor = testEnv.authenticatedContext('editor-1').database();
  const privateSchedule = ref(editor, 'schedules/2026-10-25/first');
  await assertSucceeds(get(privateSchedule));
  await assertFails(set(privateSchedule, { assignments: { camera1: 'Changed' } }));
});

test('authenticated editor can read only their own UID membership', async () => {
  const editor = testEnv.authenticatedContext('editor-1').database();
  const ownRole = await assertSucceeds(get(ref(editor, 'access/editors/editor-1')));
  assert.equal(ownRole.val(), true);
  await assertFails(get(ref(editor, 'access/editors/editor-2')));
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
