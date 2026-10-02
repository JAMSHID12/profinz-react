import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Load the actual TypeScript helpers without adding a browser or test-runner dependency.
const toModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const formatModule = toModule(await readFile(new URL('../src/utils/format.ts', import.meta.url), 'utf8'));
const calendarSource = (await readFile(new URL('../src/pages/operations/scheduleCalendar.ts', import.meta.url), 'utf8'))
  .replace("'../../utils/format'", JSON.stringify(formatModule));
const { calendarRange, moveMonth, layoutEvents, minutes, timeValue, isPastStart } = await import(toModule(calendarSource));

test('week uses Sunday through Saturday, including a year boundary', () => {
  assert.deepEqual(calendarRange('2026-10-09', 'Week'), { from: '2026-10-04', to: '2026-10-10' });
  assert.deepEqual(calendarRange('2027-01-01', 'Week'), { from: '2026-12-27', to: '2027-01-02' });
});
test('month includes complete weeks and leap-day dates', () => {
  assert.deepEqual(calendarRange('2026-10-09', 'Month'), { from: '2026-09-27', to: '2026-10-31' });
  assert.deepEqual(calendarRange('2028-02-15', 'Month'), { from: '2028-01-30', to: '2028-03-04' });
  assert.deepEqual(calendarRange('2026-10-09', 'Day'), { from: '2026-10-09', to: '2026-10-09' });
});
test('month and year navigation clamps the day instead of skipping a month', () => {
  assert.equal(moveMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(moveMonth('2028-02-29', 12), '2029-02-28');
  assert.equal(moveMonth('2026-01-31', -1), '2025-12-31');
});
const entry = (id, startTime, endTime) => ({ id, startTime, endTime });
test('overlapping classes use separate columns, adjacent classes reuse full width', () => {
  const result = layoutEvents([entry(3, '11:00', '12:00'), entry(2, '09:30', '11:00'), entry(1, '09:00', '10:00')]);
  assert.deepEqual(result.map(({ entry, column, columns }) => [entry.id, column, columns]), [[1, 0, 2], [2, 1, 2], [3, 0, 1]]);
});
test('overlap chains keep consistent widths and reuse available columns', () => {
  const result = layoutEvents([entry(1, '09:00', '10:00'), entry(2, '09:30', '10:30'), entry(3, '10:00', '11:00')]);
  assert.deepEqual(result.map(({ column, columns }) => [column, columns]), [[0, 2], [1, 2], [0, 2]]);
  assert.deepEqual(layoutEvents([]), []);
});
test('time positions accept API seconds and preserve times outside default hours', () => {
  assert.equal(minutes('07:15:00'), 435);
  assert.equal(timeValue(minutes('23:30:00')), '23:30');
});

test('past slots and the current minute are disabled only on today or older dates', () => {
  assert.equal(isPastStart('2026-10-02', '09:00', '2026-10-02', '09:30'), true);
  assert.equal(isPastStart('2026-10-02', '09:30', '2026-10-02', '09:30'), true);
  assert.equal(isPastStart('2026-10-02', '09:31', '2026-10-02', '09:30'), false);
  assert.equal(isPastStart('2026-10-03', '08:00', '2026-10-02', '09:30'), false);
  assert.equal(isPastStart('2026-10-01', '23:59', '2026-10-02', '09:30'), true);
  assert.equal(isPastStart('2026-10-02', undefined, '2026-10-02', '23:59'), true);
});