import { callPVGIS } from './pvgis';
import { getMonthlyArray, num } from './utils';
import type { ModelWarning } from './preprocess';

export const MAX_MONTHLY_HISTORY_YEARS = 20;

export type MonthlyEnergyYearBlock = {
  calendar_year: number;
  months: { month: number; kwh: number }[];
};

/** Same row mapping as simulate.parseMonthly; 12 rows per PVGIS response. */
export function parseMonthlyRows(pvcalc: unknown): { month: number; E_m: number }[] {
  const raw = getMonthlyArray(pvcalc as any);
  if (!Array.isArray(raw)) return [];

  const mapped = raw
    .map((row: any) => ({
      month: num(row.month),
      E_m: num(row['E_m'] ?? row.E_m)
    }))
    .filter((p) => p.month >= 1 && p.month <= 12);

  mapped.sort((a, b) => a.month - b.month);
  return mapped;
}

function meteoYearBounds(pvcalc: unknown): { year_min: number; year_max: number } | null {
  const meta = (pvcalc as any)?.inputs?.meteo_data;
  if (!meta || typeof meta !== 'object') return null;
  const lo = num((meta as any).year_min);
  const hi = num((meta as any).year_max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) return null;
  return { year_min: Math.floor(lo), year_max: Math.floor(hi) };
}

export function selectCalendarYearsForHistory(
  yearMin: number,
  yearMax: number,
  requestedCount: number
): number[] {
  const n = Math.min(MAX_MONTHLY_HISTORY_YEARS, Math.max(0, Math.floor(requestedCount)));
  if (n <= 0) return [];
  const span = yearMax - yearMin + 1;
  const take = Math.min(n, span);
  const start = yearMax - take + 1;
  const years: number[] = [];
  for (let y = start; y <= yearMax; y++) years.push(y);
  return years;
}

/** Sum hourly PVGIS power (W, one-hour steps) into monthly energy (kWh).
 * Reject incomplete/invalid years instead of presenting partial totals as history.
 */
export function aggregateHourlyMonths(
  data: unknown,
  year: number,
  nearShadingFactor: number
): MonthlyEnergyYearBlock['months'] {
  const hourly = (data as any)?.outputs?.hourly;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const expectedHours = (end - start) / 3600000;
  if (!Array.isArray(hourly) || hourly.length !== expectedHours) {
    throw new Error('Incomplete PVGIS hourly year');
  }
  const seen = new Set<number>();
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, kwh: 0 }));
  for (const row of hourly) {
    const match = typeof row?.time === 'string' && /^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})$/.exec(row.time);
    if (!match || typeof row.P !== 'number' || !Number.isFinite(row.P) || row.P < 0) {
      throw new Error('Invalid PVGIS hourly record');
    }
    const [, y, m, d, h, minute] = match.map(Number);
    const timestamp = Date.UTC(y, m - 1, d, h);
    const date = new Date(timestamp);
    if (y !== year || m < 1 || m > 12 || d < 1 || date.getUTCDate() !== d ||
        h > 23 || minute > 59 || timestamp < start || timestamp >= end || seen.has(timestamp)) {
      throw new Error('Invalid or duplicate PVGIS hourly timestamp');
    }
    seen.add(timestamp);
    months[m - 1].kwh += row.P / 1000;
  }
  return months.map((m) => ({ ...m, kwh: m.kwh * nearShadingFactor }));
}

/** One seriescalc call per calendar year; PVcalc only provides multi-year averages. */
export async function fetchMonthlyEnergyByCalendarYear(
  baseParams: Record<string, any>,
  radiationDatabase: string | undefined,
  representativePvcalc: unknown,
  historyYearsRequested: number,
  nearShadingFactor: number,
  warnings: ModelWarning[],
  fetchPVGIS: typeof callPVGIS = callPVGIS
): Promise<MonthlyEnergyYearBlock[]> {
  const bounds = meteoYearBounds(representativePvcalc);
  if (!bounds) return [];

  const years = selectCalendarYearsForHistory(bounds.year_min, bounds.year_max, historyYearsRequested);
  if (years.length === 0) {
    return [];
  }

  const seriesParams = { ...baseParams, pvcalculation: 1, components: 0, trackingtype: 0 };
  // Keep the same installation across all weather years, including when PVcalc
  // selected the optimal orientation from the full meteorological period.
  if (baseParams.optimalangles) {
    const fixed = (representativePvcalc as any)?.inputs?.mounting_system?.fixed;
    const angle = fixed?.slope?.value;
    const aspect = fixed?.azimuth?.value;
    if (typeof angle !== 'number' || !Number.isFinite(angle) ||
        typeof aspect !== 'number' || !Number.isFinite(aspect)) {
      warnings.push({
        code: 'pvgis.monthly_history_orientation_unavailable',
        severity: 'warning',
        message: 'PVGIS monthly history requires the resolved installation orientation.'
      });
      return [];
    }
    Object.assign(seriesParams, { angle, aspect, optimalangles: 0 });
  }

  const results = await Promise.all(
    years.map(async (calendar_year) => {
      try {
        const data = await fetchPVGIS(
          'seriescalc',
          { ...seriesParams, startyear: calendar_year, endyear: calendar_year },
          radiationDatabase ?? (representativePvcalc as any)?.inputs?.meteo_data?.radiation_db
        );
        const months = aggregateHourlyMonths(data, calendar_year, nearShadingFactor);
        return { calendar_year, months };
      } catch {
        warnings.push({
          code: 'pvgis.monthly_history_year_failed',
          severity: 'warning',
          message: `PVGIS hourly history failed or returned incomplete/invalid data for calendar year ${calendar_year}.`
        });
        return null;
      }
    })
  );

  return results.filter((x): x is MonthlyEnergyYearBlock => x != null);
}
