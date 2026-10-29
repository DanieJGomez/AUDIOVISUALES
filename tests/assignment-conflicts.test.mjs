import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findAssignmentConflicts,
  findScheduleAssignmentConflicts,
} from '../src/assignment-conflicts.js';

const roles = [
  { id: 'camera', name: 'Cámara', segment: 'full' },
  { id: 'stageFirst', name: 'Dirección de alabanza', segment: 'worship' },
  { id: 'stageSermon', name: 'Dirección de prédica', segment: 'sermon' },
];

test('permite responsables distintos para alabanza y prédica', () => {
  assert.deepEqual(findAssignmentConflicts({
    stageFirst: 'Ana',
    stageSermon: 'Ana',
  }, roles), []);
});

test('detecta un puesto de servicio completo junto a uno segmentado', () => {
  assert.deepEqual(findAssignmentConflicts({
    camera: ' Ana ',
    stageFirst: 'ana',
  }, roles), [{
    person: 'ana',
    firstRole: 'Cámara',
    secondRole: 'Dirección de alabanza',
  }]);
});

test('detecta dos asignaciones que cubren el servicio completo', () => {
  const twoFullRoles = [roles[0], { id: 'photo', name: 'Fotografía', segment: 'full' }];
  assert.equal(findAssignmentConflicts({ camera: 'Luis', photo: 'luis' }, twoFullRoles).length, 1);
});

test('no informa conflicto cuando son personas diferentes', () => {
  assert.deepEqual(findAssignmentConflicts({
    camera: 'Luis',
    stageFirst: 'Ana',
  }, roles), []);
});

test('un puesto de todo el servicio entra en conflicto con cualquier otro puesto', () => {
  const segmentRoles = [
    { id: 'camera', name: 'Cámara', segment: 'full' },
    { id: 'stageFirst', name: 'Dirección en alabanza', segment: 'worship' },
    { id: 'stageSermon', name: 'Dirección en prédica', segment: 'sermon' },
  ];
  assert.equal(findAssignmentConflicts({ camera: 'Ana', stageSermon: 'Ana' }, segmentRoles).length, 1);
  assert.equal(findAssignmentConflicts({ camera: 'Ana', stageFirst: 'Ana' }, segmentRoles).length, 1);
});

test('alabanza en un puesto y prédica en otro no generan conflicto', () => {
  const segmentRoles = [
    { id: 'camera', name: 'Cámara', segment: 'worship' },
    { id: 'photo', name: 'Fotografía', segment: 'sermon' },
  ];
  assert.deepEqual(findAssignmentConflicts({ camera: 'Ana', photo: 'Ana' }, segmentRoles), []);
});

test('dos puestos del mismo segmento sí generan conflicto', () => {
  const segmentRoles = [
    { id: 'camera', name: 'Cámara', segment: 'worship' },
    { id: 'photo', name: 'Fotografía', segment: 'worship' },
  ];
  assert.deepEqual(findAssignmentConflicts({ camera: 'Ana', photo: 'Ana' }, segmentRoles), [{
    person: 'Ana', firstRole: 'Cámara', secondRole: 'Fotografía',
  }]);
});

test('asignaciones vacías y valores que no son nombres no generan conflictos', () => {
  assert.deepEqual(findAssignmentConflicts({ camera: '', stageFirst: '  ', stageSermon: null }, roles), []);
});

test('fechas y reuniones se validan por separado', () => {
  const conflicts = findScheduleAssignmentConflicts([
    { date: '2026-11-01', meeting: 'first', assignments: { camera: 'Ana' } },
    { date: '2026-11-01', meeting: 'second', assignments: { photo: 'Ana' } },
    { date: '2026-11-08', meeting: 'first', assignments: { stageFirst: 'Ana' } },
  ], [
    { id: 'camera', name: 'Cámara', segment: 'full' },
    { id: 'photo', name: 'Fotografía', segment: 'full' },
    { id: 'stageFirst', name: 'Dirección en alabanza', segment: 'worship' },
  ]);
  assert.deepEqual(conflicts, []);
});

test('reporta persona, puestos y ruta del servicio con conflicto', () => {
  assert.deepEqual(findScheduleAssignmentConflicts([
    { date: '2026-11-01', meeting: 'first', assignments: { camera: ' Ana ', photo: 'ana' } },
  ], [
    { id: 'camera', name: 'Cámara', segment: 'full' },
    { id: 'photo', name: 'Fotografía', segment: 'full' },
  ]), [{
    person: 'ana', firstRole: 'Cámara', secondRole: 'Fotografía', date: '2026-11-01', meeting: 'first',
  }]);
});
