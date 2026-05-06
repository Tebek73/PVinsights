import assert from 'node:assert/strict';
import {
  MAX_MONTHLY_HISTORY_YEARS,
  parseMonthlyRows,
  selectCalendarYearsForHistory
} from './pv_monthly_history';

function testSelectYears(): void {
  assert.deepEqual(selectCalendarYearsForHistory(2018, 2020, 5), [2018, 2019, 2020]);
  assert.deepEqual(selectCalendarYearsForHistory(2018, 2020, 2), [2019, 2020]);
  assert.deepEqual(selectCalendarYearsForHistory(2000, 2020, 3), [2018, 2019, 2020]);
  assert.deepEqual(selectCalendarYearsForHistory(2000, 2020, MAX_MONTHLY_HISTORY_YEARS + 5).length, 20);
}

function testParseMonthlyRows(): void {
  const pvcalc = {
    outputs: {
      monthly: {
        fixed: [
          { month: 3, E_m: 90 },
          { month: 1, E_m: 50 },
          { month: 2, E_m: 70 }
        ]
      }
    }
  };
  const rows = parseMonthlyRows(pvcalc);
  assert.deepEqual(
    rows.map((r) => r.month),
    [1, 2, 3]
  );
  assert.deepEqual(
    rows.map((r) => r.E_m),
    [50, 70, 90]
  );
}

function testParseFallbackOutputsMonthly(): void {
  const pvcalc = {
    outputs: {
      monthly: [{ month: 12, E_m: 40 }]
    }
  };
  const rows = parseMonthlyRows(pvcalc);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.month, 12);
  assert.equal(rows[0]?.E_m, 40);
}

function run(): void {
  testSelectYears();
  testParseMonthlyRows();
  testParseFallbackOutputsMonthly();
  console.log('[test:monthly_chart] OK');
}

run();
