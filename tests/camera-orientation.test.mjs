import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraConePath, normalizeAngle } from '../src/camera-orientation.js';

test('normalizes camera angles to a full turn', () => {
    assert.equal(normalizeAngle(-90), 270);
    assert.equal(normalizeAngle(450), 90);
    assert.equal(normalizeAngle(360), 0);
});

test('builds a symmetric cone around the local forward axis', () => {
    assert.equal(cameraConePath(), 'M0 0 L409.86300112664924 -208.8356298801915 A460 460 0 0 1 409.86300112664924 208.8356298801915 Z');
    assert.match(cameraConePath(100, 45), /^M0 0 L70\.710678.* A100 100 0 0 1 70\.710678.* Z$/);
});
