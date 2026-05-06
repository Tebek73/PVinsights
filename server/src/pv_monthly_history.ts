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

/**
 * One PVcalc call per calendar year (startyear=endyear=Y). Applies near-shading factor to kWh.
 */
export async function fetchMonthlyEnergyByCalendarYear(
  baseParams: Record<string, any>,
  radiationDatabase: string | undefined,
  representativePvcalc: unknown,
  historyYearsRequested: number,
  nearShadingFactor: number,
  warnings: ModelWarning[]
): Promise<MonthlyEnergyYearBlock[]> {
  const bounds = meteoYearBounds(representativePvcalc);
  if (!bounds) return [];

  const years = selectCalendarYearsForHistory(bounds.year_min, bounds.year_max, historyYearsRequested);
  if (years.length === 0) {
    return [];
  }

  const results = await Promise.all(
    years.map(async (calendar_year) => {
      try {
        const data = await callPVGIS(
          'PVcalc',
          { ...baseParams, startyear: calendar_year, endyear: calendar_year },
          radiationDatabase
        );
        const rows = parseMonthlyRows(data);
        if (rows.length === 0) return null;
        const months = rows.map((r) => ({
          month: r.month,
          kwh: r.E_m * nearShadingFactor
        }));
        return { calendar_year, months };
      } catch {
        warnings.push({
          code: 'pvgis.monthly_history_year_failed',
          severity: 'warning',
          message: `PVGIS monthly history call failed for calendar year ${calendar_year}.`
        });
        return null;
      }
    })
  );

  return results.filter((x): x is MonthlyEnergyYearBlock => x != null);
}
