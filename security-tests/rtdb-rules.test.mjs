import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, runTransaction, set } from 'firebase/database';

const PROJECT_ID = 'demo-cmb-audiovisual-security';
const TEST_PATH = 'diagnostics/connectionTest';
const VALID_RECORD = {
  ok: true,
  timestamp: '2026-10-28T18:04:05.123Z',
  source: 'firebase-diagnostics',
};

function validSchedule(uid, overrides = {}) {
  return {
    assignments: { camera1: 'Server A' },
    people: ['Server A'],
    tasks: [{ text: 'Check camera', completed: false, assignee: 'Server A' }],
    arrival: '07:00 AM',
    dress: 'Formal',
    dressColor: '#000000',
    notes: 'private note',
    updatedAt: '2026-10-28T18:04:05.123Z',
    updatedBy: uid,
    ...overrides,
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function writeDataIfUnchanged(scheduleRef, value, expectedValue) {
  const expected = JSON.stringify(stableValue(expectedValue));
  return runTransaction(scheduleRef, (currentValue) => {
    if (JSON.stringify(stableValue(currentValue)) !== expected) return undefined;
    return value;
  }, { applyLocally: false });
}

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
          first: validSchedule('editor-1'),
          second: validSchedule('editor-1', { assignments: { camera1: 'Server B' } }),
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
  await assertFails(set(ref(db, 'access/admins/admin-1'), false));
});

test('authorized administrator can read and write a valid private schedule', async () => {
  const db = testEnv.authenticatedContext('admin-1').database();
  const scheduleRef = ref(db, 'schedules/2026-10-25/second');
  const initial = await assertSucceeds(get(scheduleRef));
  assert.equal(initial.val().notes, 'private note');

  const updatedSchedule = validSchedule('admin-1', {
    assignments: { camera1: 'Admin Updated' },
  });
  await assertSucceeds(set(scheduleRef, updatedSchedule));
  const updated = await assertSucceeds(get(scheduleRef));
  assert.deepEqual(updated.val(), updatedSchedule);
});

test('users cannot assign themselves editor or administrator permissions', async () => {
  const db = testEnv.authenticatedContext('editor-1').database();
  await assertFails(set(ref(db, 'access/editors/editor-1'), true));
  await assertFails(set(ref(db, 'access/admins/editor-1'), true));
  const outsider = testEnv.authenticatedContext('outsider-1').database();
  await assertFails(set(ref(outsider, 'access/editors/outsider-1'), true));
  await assertFails(set(ref(outsider, 'access/admins/outsider-1'), true));
  await assertFails(get(ref(db, 'access')));
  await assertFails(set(ref(db, 'access/editors/editor-2'), true));
  await assertFails(set(ref(db, 'access/unlisted/another-user'), true));
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

test('visitor can read a published projection but cannot read or write private schedules', async () => {
  const db = testEnv.unauthenticatedContext().database();
  const scheduleRef = ref(db, 'schedules/2026-10-25/first');
  await assertFails(get(scheduleRef));
  await assertFails(set(scheduleRef, validSchedule('visitor')));
  const published = await assertSucceeds(get(ref(db, 'publicData/schedules/2026-10-25/first')));
  assert.equal(published.val().published, true);
  await assertFails(set(ref(db, 'publicData/schedules/2026-10-25/second'), {
    published: true,
    assignments: { camera1: 'Visitor edit' },
  }));
});

test('authorized editor can read and modify private schedule; unlisted user cannot write', async () => {
  const editorOne = testEnv.authenticatedContext('editor-1').database();
  const editorTwo = testEnv.authenticatedContext('editor-2').database();
  const outsider = testEnv.authenticatedContext('outsider-1').database();
  const schedulePath = 'schedules/2026-10-25/second';
  const initial = await assertSucceeds(get(ref(editorOne, schedulePath)));
  assert.equal(initial.val().notes, 'private note');
  await assertSucceeds(set(ref(editorOne, schedulePath), validSchedule('editor-1', {
    assignments: { camera1: 'Server C' },
  })));
  await assertFails(remove(ref(editorOne, schedulePath)));
  const shared = await assertSucceeds(get(ref(editorTwo, schedulePath)));
  assert.equal(shared.val().assignments.camera1, 'Server C');
  await assertFails(set(ref(outsider, schedulePath), validSchedule('outsider-1')));
});

test('stale schedule transaction is rejected without replacing the newer version', async () => {
  const editorOne = testEnv.authenticatedContext('editor-1').database();
  const editorTwo = testEnv.authenticatedContext('editor-2').database();
  const schedulePath = 'schedules/2026-10-25/second';
  const editorOneSchedule = ref(editorOne, schedulePath);
  const editorTwoSchedule = ref(editorTwo, schedulePath);
  const baseline = (await assertSucceeds(get(editorOneSchedule))).val();

  const newerSchedule = validSchedule('editor-2', {
    assignments: { camera1: 'Newer version' },
  });
  await assertSucceeds(set(editorTwoSchedule, newerSchedule));

  const staleWrite = await writeDataIfUnchanged(
    editorOneSchedule,
    validSchedule('editor-1', { assignments: { camera1: 'Stale version' } }),
    baseline
  );
  assert.equal(staleWrite.committed, false);
  const stored = await assertSucceeds(get(editorOneSchedule));
  assert.deepEqual(stored.val(), newerSchedule);
});

test('authorized user cannot forge updatedBy or write extra private fields', async () => {
  const editor = testEnv.authenticatedContext('editor-1').database();
  const scheduleRef = ref(editor, 'schedules/2026-10-25/second');
  await assertFails(set(scheduleRef, validSchedule('editor-2')));
  await assertFails(set(scheduleRef, validSchedule('editor-1', { internalFlag: 'unexpected' })));
  await assertFails(set(scheduleRef, validSchedule('editor-1', { notes: 42 })));
  await assertFails(set(scheduleRef, validSchedule('editor-1', {
    assignments: { camera1: 12 },
  })));
  await assertFails(set(scheduleRef, validSchedule('editor-1', {
    tasks: [{ text: 'Check camera', completed: 'false', assignee: 'Server A' }],
  })));
  const missingNotes = validSchedule('editor-1');
  delete missingNotes.notes;
  await assertFails(set(scheduleRef, missingNotes));
  await assertFails(set(scheduleRef, validSchedule('editor-1', {
    people: Array.from({ length: 101 }, (_, index) => `Person ${index}`),
  })));
  await assertFails(set(scheduleRef, validSchedule('editor-1', {
    tasks: Array.from({ length: 101 }, (_, index) => ({
      text: `Task ${index}`,
      completed: false,
      assignee: '',
    })),
  })));
  await assertFails(set(ref(editor, 'schedules/2026-10-25/second/assignments/unlistedRole'), 'Server A'));
  await assertFails(set(ref(editor, 'schedules/not-a-date/second'), validSchedule('editor-1')));
});

test('a published projection locks its private source until it is unpublished', async () => {
  const editor = testEnv.authenticatedContext('editor-1').database();
  const privateSchedule = ref(editor, 'schedules/2026-10-25/first');
  await assertSucceeds(get(privateSchedule));
  await assertFails(set(privateSchedule, validSchedule('editor-1', {
    assignments: { camera1: 'Changed' },
  })));
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
