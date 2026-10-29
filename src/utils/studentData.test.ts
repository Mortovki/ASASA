import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStudentProfiles, mergeStudentRecords, getStudentApprovedHours,
  isStudentFinished, matchesStudentCategories, reconcileCategorySelection,
} from './studentData';

test('empty and subsequent snapshots never retain sample, cached, or removed profiles', () => {
  assert.deepEqual(normalizeStudentProfiles([]), []);
  const first = normalizeStudentProfiles([{ id: 'real', data: { firstName: 'Alumno' } }]);
  assert.equal(first.length, 1);
  assert.deepEqual(normalizeStudentProfiles([]), []);
  assert.deepEqual(normalizeStudentProfiles([{ id: 'other', data: {} }]).map(s => s.id), ['other']);
});

test('Firestore document identity wins over old fields without dropping session aliases', () => {
  const [student] = normalizeStudentProfiles([{ id: 'auth-uid', data: { id: 'old-id', uid: 'old-uid' } }]);
  assert.equal(student.id, 'auth-uid');
  assert.equal(student.uid, 'auth-uid');
  assert.equal(mergeStudentRecords(student, [{ id: 'session', userId: 'old-id', horasCalculadas: 3, estado: 'aprobado' }]).length, 1);
});

test('migrated profiles appear once and keep only current skills and assignments', () => {
  const documents = [
    { id: 'legacy', data: { email: 'Alumno@Example.test', updatedAt: '2025-01-01', skills: ['Anterior'], projectIds: ['old-project'] } },
    { id: 'auth-uid', data: { email: 'alumno@example.test', updatedAt: '2026-01-01', skills: ['Actual'], projectIds: ['real-project'] } },
  ];
  const profiles = normalizeStudentProfiles(documents);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].id, 'auth-uid');
  assert.deepEqual(profiles[0].skills, ['Actual']);
  assert.deepEqual(profiles[0].projectIds, ['real-project']);
  assert.deepEqual(normalizeStudentProfiles(documents), profiles);
  assert.equal(mergeStudentRecords(profiles[0], [{ id: 'session', userId: 'legacy' }]).length, 1);
});

test('current empty fields are not refilled from older profiles', () => {
  const [profile] = normalizeStudentProfiles([
    { id: 'old', data: { email: 'a@example.test', skills: ['Old'], projectIds: ['old'], updatedAt: '2025-01-01' } },
    { id: 'new', data: { email: 'a@example.test', skills: [], projectIds: [], updatedAt: '2026-01-01' } },
  ]);
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(profile.projectIds, []);
});

test('sessions attach by UID, historical ID, studentId, or matrícula without crossing students', () => {
  const student = { id: 'uid', studentId: '123456', identityIds: ['old'] };
  const sessions = [
    { id: 'uid-session', userId: 'uid' }, { id: 'legacy-session', userId: 'old' },
    { id: 'student-session', studentId: 'uid' }, { id: 'matricula-session', matricula: '123456' },
    { id: 'other-session', userId: 'another-person' },
  ];
  assert.deepEqual(mergeStudentRecords(student, sessions).map(r => r.id),
    ['uid-session', 'legacy-session', 'student-session', 'matricula-session']);
});

test('a live pending session replaces an older approval and its hours', () => {
  const student = { id: 'uid', records: [{ id: 'session', hours: 4, validationStatus: 'aprobado' }] };
  const records = mergeStudentRecords(student, [{ id: 'session', userId: 'uid', horasCalculadas: 2, estado: 'pendiente' }]);
  assert.equal(records.length, 1);
  assert.equal(records[0].hours, 2);
  assert.equal(records[0].validationStatus, 'pendiente');
  assert.equal(getStudentApprovedHours({ records }), 0);
});

test('remote deletions disappear while unrelated embedded legacy records are preserved', () => {
  const student = { id: 'uid', records: [{ id: 'deleted', hours: 4 }, { id: 'legacy', hours: 2 }] };
  assert.deepEqual(mergeStudentRecords(student, [], ['deleted']).map(r => r.id), ['legacy']);
  assert.equal(mergeStudentRecords(student, [{ id: 'deleted', userId: 'uid' }], ['deleted']).length, 2);
});

test('pending attendance does not archive students even when status says they attended', () => {
  const student = { records: [{ id: 's', hours: 480, validationStatus: 'pendiente', status: 'A' }] };
  assert.equal(getStudentApprovedHours(student), 0);
  assert.equal(isStudentFinished(student), false);
  assert.equal(isStudentFinished({ records: [{ id: 's', hours: 480, estado: 'aprobado' }] }), true);
});

test('personal names never manufacture approved hours or completion', () => {
  const student = { firstName: 'Karla', lastNamePaterno: 'Espinoza', records: [] };
  assert.equal(getStudentApprovedHours(student), 0);
  assert.equal(isStudentFinished(student), false);
});

test('legacy hour totals survive missing or invalid alternative total fields', () => {
  assert.equal(getStudentApprovedHours({ horasTotales: 12, totalHours: 'invalid' }), 12);
  assert.equal(getStudentApprovedHours({ records: [{ hours: 3, status: 'A' }] }), 3);
});

test('category updates preserve the all-categories selection and include students without records', () => {
  const first = reconcileCategorySelection([], [], ['one']);
  const next = reconcileCategorySelection(first, ['one'], ['one', 'two']);
  assert.deepEqual(next, ['one', 'two']);
  assert.equal(matchesStudentCategories({ records: [] }, next, [{ id: 'one' }, { id: 'two' }]), true);
  assert.deepEqual(reconcileCategorySelection(['one'], ['one', 'two'], ['one', 'two', 'three']), ['one']);
  assert.equal(matchesStudentCategories({ records: [] }, ['one'], [{ id: 'one' }, { id: 'two' }]), false);
  assert.equal(matchesStudentCategories({ records: [] }, [], [{ id: 'one' }]), false);
});
