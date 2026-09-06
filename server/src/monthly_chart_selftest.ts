import assert from 'node:assert/strict';
import {
  MAX_MONTHLY_HISTORY_YEARS,
  aggregateHourlyMonths,
  fetchMonthlyEnergyByCalendarYear,
  parseMonthlyRows,
  selectCalendarYearsForHistory
} from './pv_monthly_history';
import type { ModelWarning } from './preprocess';

function hourlyYear(year: number, watts: number) {
  const hourly: { time: string; P: number }[] = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 3600000) {
    const iso = new Date(t).toISOString();
    hourly.push({ time: iso.slice(0, 10).replace(/-/g, '') + ':' + iso.slice(11, 13) + '10', P: watts });
  }
  return { outputs: { hourly } };
}

function testHourlyAggregation(): void {
  const normal = aggregateHourlyMonths(hourlyYear(2019, 1000), 2019, 0.9);
  assert.equal(normal.length, 12);
  assert.equal(normal[0].kwh, 31 * 24 * 0.9);
  assert.equal(normal[1].kwh, 28 * 24 * 0.9);
  assert.equal(aggregateHourlyMonths(hourlyYear(2020, 1000), 2020, 1)[1].kwh, 29 * 24);
  assert.equal(aggregateHourlyMonths(hourlyYear(2020, 0), 2020, 1)[0].kwh, 0);
  const incomplete = hourlyYear(2019, 1000);
  incomplete.outputs.hourly.pop();
  assert.throws(() => aggregateHourlyMonths(incomplete, 2019, 1));
  const duplicate = hourlyYear(2019, 1000);
  duplicate.outputs.hourly[1] = duplicate.outputs.hourly[0];
  assert.throws(() => aggregateHourlyMonths(duplicate, 2019, 1));
  const invalid = hourlyYear(2019, 1000);
  invalid.outputs.hourly[0].P = NaN;
  assert.throws(() => aggregateHourlyMonths(invalid, 2019, 1));
  assert.throws(() => aggregateHourlyMonths(hourlyYear(2019, 1000), 2021, 1));
  assert.throws(() => aggregateHourlyMonths({ outputs: { monthly: [] } }, 2019, 1));
}

async function testHistoricalRequests(): Promise<void> {
  const representative = {
    inputs: {
      meteo_data: { year_min: 2019, year_max: 2021, radiation_db: 'PVGIS-SARAH3' },
      mounting_system: { fixed: { slope: { value: 35 }, azimuth: { value: -5 } } }
    }
  };
  const warnings: ModelWarning[] = [];
  const requested: number[] = [];
  const history = await fetchMonthlyEnergyByCalendarYear(
    { lat: 44, lon: 26, peakpower: 5, loss: 14, optimalangles: 1, usehorizon: 1, userhorizon: '0,0' },
    undefined, representative, 3, 0.9, warnings,
    async (tool, params, database) => {
      assert.equal(tool, 'seriescalc');
      assert.equal(params.pvcalculation, 1);
      assert.equal(params.startyear, params.endyear);
      assert.equal(params.angle, 35);
      assert.equal(params.aspect, -5);
      assert.equal(params.optimalangles, 0);
      assert.equal(params.peakpower, 5);
      assert.equal(params.loss, 14);
      assert.equal(params.userhorizon, '0,0');
      assert.equal(database, 'PVGIS-SARAH3');
      const year = Number(params.startyear);
      requested.push(year);
      if (year === 2021) return { outputs: { hourly: [] } };
      return hourlyYear(year, year === 2019 ? 1000 : 2000);
    }
  );
  assert.deepEqual(requested, [2019, 2020, 2021]);
  assert.deepEqual(history.map((b) => b.calendar_year), [2019, 2020]);
  assert.equal(history[0].months[0].kwh, 31 * 24 * 0.9);
  assert.equal(history[1].months[0].kwh, 31 * 24 * 2 * 0.9);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, 'pvgis.monthly_history_year_failed');
  assert.deepEqual(await fetchMonthlyEnergyByCalendarYear({}, undefined, representative, 0, 1, [],
    async () => { throw new Error('History disabled: must not fetch'); }), []);
}

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

async function run(): Promise<void> {
  testSelectYears();
  testParseMonthlyRows();
  testParseFallbackOutputsMonthly();
  testHourlyAggregation();
  await testHistoricalRequests();
  console.log('[test:monthly_chart] OK');
}

run().catch((err) => { console.error(err); process.exitCode = 1; });
