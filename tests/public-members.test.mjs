import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePublicMembers } from '../src/scheduling.js';

const approvedMembers = [
  'Juan Pablo',
  'Liseth Chiquiza',
  'Lizeth Londoño',
  'Dilan',
  'Marco',
  'Daniel Gomez',
  'Evelin',
  'Daniel Pineda',
  'David Mateus',
  'Paula',
  'Johana',
  'Samuel Herrera',
  'Stiven',
  'Maicol',
  'Sebastian',
  'David Bonilla',
  'Laura',
];

test('normalizes the approved 17 members from an array unchanged', () => {
  assert.deepEqual(normalizePublicMembers(approvedMembers), approvedMembers);
});

test('normalizes Firebase numeric-key objects in index order', () => {
  const firebaseObject = Object.fromEntries(
    approvedMembers.map((name, index) => [String(index), name])
  );
  assert.deepEqual(normalizePublicMembers(firebaseObject), approvedMembers);
});

test('rejects non-contiguous keys and invalid member values', () => {
  assert.equal(normalizePublicMembers({ 0: 'Ana', 2: 'Luis' }), null);
  assert.equal(normalizePublicMembers({ 0: 'Ana', extra: 'Luis' }), null);
  assert.equal(normalizePublicMembers(['Ana', '  ']), null);
  assert.equal(normalizePublicMembers(null), null);
});
