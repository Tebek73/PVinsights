import { callPVGIS, getHorizonProfile } from './pvgis';
import { getMonthlyArray, num } from './utils';
import type { SimulateInput } from './schema';

const AREA_TYPE_FACTOR: Record<'rural' | 'suburban' | 'urban', number> = {
  rural: 1.0,
  suburban: 0.92,
  urban: 0.85
};

type MonthlyPoint = {
  month: number;
  E_m: number;
  SD_m: number;
  H_i_m: number;
};

export type Totals = {
  E_y: number;
  SD_y: number;
  H_i_y: number;
  l_total: number;
  LCOE_pv?: number | null;
};

export type Economics = SimulateInput['economics'];

export type FinanceResult = {
  savings_year1: number;
  payback_years: number | null;
  roi: number | null;
  npv: number | null;
  cashflow_yearly: number[];
  cashflow_cumulative: number[];
};

export type SimulationResult = {
  pvgis: {
    inputs: any;
    monthly: MonthlyPoint[];
    totals: Totals;
  };
  kpis: {
    annual_kwh: number;
    specific_yield_kwh_per_kwp: number;
    capacity_factor_pct: number;
    best_month: { month: number; kwh: number } | null;
    worst_month: { month: number; kwh: number } | null;
    seasonality_ratio: number | null;
    uncertainty_annual_kwh: number;
  };
  finance: {
    savings_year1: number;
    payback_years: number | null;
    roi: number | null;
    npv: number | null;
    cashflow_yearly: number[];
    cashflow_cumulative: number[];
  };
  charts: {
    monthly_energy_kwh: { month: number; kwh: number }[];
    cashflow_cumulative: { year: number; value: number }[];
  };
  insights: { type: 'info' | 'warning'; text: string; key?: string }[];
  meta?: { area_type_applied: 'rural' | 'suburban' | 'urban' | null };
  scenarios?: {
    by_self_consumption: { self_consumption: number; payback_years: number | null; npv: number | null; savings_year1: number }[];
    by_price_buy: { price_buy: number; payback_years: number | null; npv: number | null; savings_year1: number }[];
  };
  sensitivity?: {
    one_d: { variable: 'price_buy'; values: number[]; payback_years: (number | null)[]; npv: (number | null)[] };
    two_d: {
      variable_x: 'price_buy';
      variable_y: 'self_consumption';
      x_axis: number[];
      y_axis: number[];
      payback_grid: (number | null)[][];
      npv_grid: (number | null)[][];
    };
  };
  monte_carlo?: {
    n_trials: number;
    target_payback_years?: number;
    payback: { p10: number; p50: number; p90: number; prob_under_target?: number };
    npv: { p10: number; p50: number; p90: number };
    histogram_bins?: {
      payback: { edges: number[]; counts: number[] };
      npv: { edges: number[]; counts: number[] };
    };
  };
  break_even?: {
    target_payback_years?: number;
    break_even_capex: number | null;
    break_even_price_buy: number | null;
  };
  kwp_optimization?: {
    recommended_kwp_npv: number;
    recommended_kwp_payback: number;
    curve: { kwp: number; npv: number; payback_years: number | null }[];
  };
};

export async function runSimulation(input: SimulateInput): Promise<SimulationResult> {
  const { location, pv, economics } = input;

  const pvParams: Record<string, any> = {
    lat: location.lat,
    lon: location.lon,
    peakpower: pv.peakpower_kw,
    loss: pv.loss_percent,
    usehorizon: pv.usehorizon ? 1 : 0,
    pvtechchoice: pv.pvtechchoice,
    mountingplace: pv.mountingplace,
    optimalangles: pv.optimalangles ? 1 : 0
  };

  if (!pv.optimalangles && pv.angle_deg != null && pv.aspect_deg != null) {
    pvParams.angle = pv.angle_deg;
    pvParams.aspect = pv.aspect_deg;
  }

  if (pv.usehorizon) {
    try {
      const horizon = await getHorizonProfile(location.lat, location.lon);
      pvParams.userhorizon = horizon.join(',');
      pvParams.usehorizon = 1;
    } catch {
      // keep usehorizon=1, PVGIS will use internal DEM
    }
  }

  const radiationDatabase =
    pv.raddatabase && pv.raddatabase.trim().length > 0 ? pv.raddatabase : undefined;

  const pvcalc = await callPVGIS('PVcalc', pvParams, radiationDatabase);

  let monthly = parseMonthly(pvcalc);
  let totals = parseTotals(pvcalc);

  const areaType = location.area_type && AREA_TYPE_FACTOR[location.area_type] !== undefined
    ? location.area_type
    : null;
  const shadingFactor = areaType ? AREA_TYPE_FACTOR[areaType] : 1;

  if (shadingFactor !== 1) {
    totals = {
      ...totals,
      E_y: totals.E_y * shadingFactor,
      SD_y: totals.SD_y * shadingFactor
    };
    monthly = monthly.map((m) => ({
      ...m,
      E_m: m.E_m * shadingFactor,
      SD_m: m.SD_m * shadingFactor
    }));
  }

  const kpis = computeKpis(totals, monthly, pv.peakpower_kw);
  const finance = computeFinanceFromTotals(totals, economics);
  const charts = buildCharts(monthly, economics.capex, finance.cashflow_cumulative);
  const insights = buildInsights(pv, totals, kpis, areaType);
  const scenarios = buildScenarios(totals, economics);
  const sensitivity = buildSensitivity(totals, economics);
  const monte_carlo = buildMonteCarlo(totals, economics);
  const break_even = buildBreakEven(totals, economics);
  const kwp_optimization =
    input.cost_model && input.consumption
      ? buildKwpOptimization(
          totals,
          economics,
          pv.peakpower_kw,
          input.cost_model,
          input.consumption,
          input.kwp_range
        )
      : undefined;

  return {
    pvgis: {
      inputs: pvcalc?.inputs ?? null,
      monthly,
      totals
    },
    kpis,
    finance,
    charts,
    insights,
    meta: { area_type_applied: areaType },
    scenarios,
    sensitivity,
    monte_carlo,
    break_even,
    kwp_optimization
  };
}

function parseMonthly(pvcalc: any): MonthlyPoint[] {
  const raw = getMonthlyArray(pvcalc);
  if (!Array.isArray(raw)) return [];

  const mapped: MonthlyPoint[] = raw
    .map((row: any) => ({
      month: num(row.month),
      E_m: num(row['E_m'] ?? row.E_m),
      SD_m: num(row['SD_m'] ?? row.SD_m),
      H_i_m: num(row['H(i)_m'] ?? row['H(i)_m'] ?? row.H_i_m)
    }))
    .filter((p) => p.month >= 1 && p.month <= 12);

  mapped.sort((a, b) => a.month - b.month);
  return mapped;
}

function parseTotals(pvcalc: any): Totals {
  const fixed = pvcalc?.outputs?.totals?.fixed ?? pvcalc?.outputs?.totals ?? {};

  const E_y = num(fixed['E_y'] ?? fixed.E_y);
  const SD_y = num(fixed['SD_y'] ?? fixed.SD_y);
  const H_i_y = num(fixed['H(i)_y'] ?? fixed['H(i)_y'] ?? fixed.H_i_y);
  const l_total = num(fixed['l_total'] ?? fixed.l_total);

  const LCOE_pvRaw = fixed['LCOE_pv'] ?? fixed.LCOE_pv;
  const LCOE_pv = LCOE_pvRaw == null ? null : num(LCOE_pvRaw);

  return {
    E_y,
    SD_y,
    H_i_y,
    l_total,
    LCOE_pv
  };
}

function computeKpis(totals: Totals, monthly: MonthlyPoint[], peakpower_kw: number) {
  const E_y = totals.E_y;
  const P = peakpower_kw;

  const specific_yield_kwh_per_kwp = P > 0 ? E_y / P : 0;
  const capacity_factor = P > 0 ? E_y / (P * 8760) : 0;
  const capacity_factor_pct = capacity_factor * 100;

  let best_month: { month: number; kwh: number } | null = null;
  let worst_month: { month: number; kwh: number } | null = null;

  for (const m of monthly) {
    if (!best_month || m.E_m > best_month.kwh) {
      best_month = { month: m.month, kwh: m.E_m };
    }
    if (!worst_month || m.E_m < worst_month.kwh) {
      worst_month = { month: m.month, kwh: m.E_m };
    }
  }

  const seasonality_ratio =
    best_month && worst_month && worst_month.kwh > 0
      ? best_month.kwh / worst_month.kwh
      : null;

  const uncertainty_annual_kwh = totals.SD_y;

  return {
    annual_kwh: E_y,
    specific_yield_kwh_per_kwp,
    capacity_factor_pct,
    best_month,
    worst_month,
    seasonality_ratio,
    uncertainty_annual_kwh
  };
}

export function computeFinanceFromTotals(
  totals: Totals,
  economics: Economics
): FinanceResult {
  const {
    capex,
    price_buy,
    self_consumption,
    price_sell,
    opex_yearly,
    degradation,
    analysis_years,
    discount_rate,
    price_escalation
  } = economics;

  const E1 = totals.E_y;
  const N = analysis_years;
  const d = degradation;
  const g = price_escalation;

  const cashflow_yearly: number[] = [];
  const cashflow_cumulative: number[] = [];

  let cum = -capex;
  let sumSavings = 0;
  let npvSum = 0;
  let payback_years: number | null = null;

  for (let t = 1; t <= N; t++) {
    const E_t = E1 * Math.pow(1 - d, t - 1);
    const price_buy_t = price_buy * Math.pow(1 + g, t - 1);

    const E_self = E_t * self_consumption;
    const E_export = E_t - E_self;

    const savings =
      E_self * price_buy_t + E_export * price_sell - (opex_yearly ?? 0);

    sumSavings += savings;
    cashflow_yearly.push(savings);

    cum += savings;
    cashflow_cumulative.push(cum);

    if (payback_years === null && cum >= 0) {
      payback_years = t;
    }

    const r = discount_rate;
    if (r > 0) {
      npvSum += savings / Math.pow(1 + r, t);
    }
  }

  const roi =
    capex > 0
      ? (sumSavings - capex) / capex
      : null;

  const npv = discount_rate > 0 ? npvSum - capex : null;

  const savings_year1 = cashflow_yearly[0] ?? 0;

  return {
    savings_year1,
    payback_years,
    roi,
    npv,
    cashflow_yearly,
    cashflow_cumulative
  };
}

function buildScenarios(
  totals: Totals,
  economics: Economics
): NonNullable<SimulationResult['scenarios']> {
  const by_self_consumption: NonNullable<SimulationResult['scenarios']>['by_self_consumption'] = [
    0.3, 0.5, 0.7
  ].map((self_consumption) => {
    const fin = computeFinanceFromTotals(totals, { ...economics, self_consumption });
    return {
      self_consumption,
      payback_years: fin.payback_years,
      npv: fin.npv,
      savings_year1: fin.savings_year1
    };
  });
  const basePrice = economics.price_buy;
  const by_price_buy: NonNullable<SimulationResult['scenarios']>['by_price_buy'] = [
    basePrice * 0.8,
    basePrice,
    basePrice * 1.2
  ].map((price_buy) => {
    const fin = computeFinanceFromTotals(totals, { ...economics, price_buy });
    return {
      price_buy,
      payback_years: fin.payback_years,
      npv: fin.npv,
      savings_year1: fin.savings_year1
    };
  });
  return { by_self_consumption, by_price_buy };
}

function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return count === 1 ? [min] : [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(min + (max - min) * (i / (count - 1)));
  }
  return out;
}

function buildSensitivity(
  totals: Totals,
  economics: Economics
): NonNullable<SimulationResult['sensitivity']> {
  const basePrice = economics.price_buy;
  const oneDValues = linspace(basePrice * 0.5, basePrice * 1.5, 11);
  const payback1D: (number | null)[] = [];
  const npv1D: (number | null)[] = [];
  for (const price_buy of oneDValues) {
    const fin = computeFinanceFromTotals(totals, { ...economics, price_buy });
    payback1D.push(fin.payback_years);
    npv1D.push(fin.npv);
  }
  const one_d: NonNullable<SimulationResult['sensitivity']>['one_d'] = {
    variable: 'price_buy',
    values: oneDValues,
    payback_years: payback1D,
    npv: npv1D
  };

  const xAxis = linspace(basePrice * 0.6, basePrice * 1.4, 9);
  const yAxis = linspace(0.2, 0.9, 9);
  const paybackGrid: (number | null)[][] = [];
  const npvGrid: (number | null)[][] = [];
  for (let i = 0; i < xAxis.length; i++) {
    paybackGrid.push([]);
    npvGrid.push([]);
    for (let j = 0; j < yAxis.length; j++) {
      const fin = computeFinanceFromTotals(totals, {
        ...economics,
        price_buy: xAxis[i],
        self_consumption: yAxis[j]
      });
      paybackGrid[i].push(fin.payback_years);
      npvGrid[i].push(fin.npv);
    }
  }
  const two_d: NonNullable<SimulationResult['sensitivity']>['two_d'] = {
    variable_x: 'price_buy',
    variable_y: 'self_consumption',
    x_axis: xAxis,
    y_axis: yAxis,
    payback_grid: paybackGrid,
    npv_grid: npvGrid
  };
  return { one_d, two_d };
}

/** Box-Muller: return a sample from N(0,1). Avoid log(0) when u1 is 0. */
function normalSample(): number {
  let u1 = Math.random();
  const u2 = Math.random();
  if (u1 <= 0) u1 = 1e-10;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function buildHistogram(values: number[], numBins: number): { edges: number[]; counts: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (values.length === 0) {
    const edges: number[] = [];
    for (let i = 0; i <= numBins; i++) edges.push(min);
    return { edges, counts: new Array(numBins).fill(0) };
  }
  if (min === max) {
    return { edges: [min, min], counts: [values.length] };
  }
  const range = max - min;
  const counts = new Array(numBins).fill(0);
  for (const v of values) {
    const bin = Math.min(Math.floor(((v - min) / range) * numBins), numBins - 1);
    counts[bin]++;
  }
  const edges: number[] = [];
  for (let i = 0; i <= numBins; i++) {
    edges.push(min + (range * i) / numBins);
  }
  return { edges, counts };
}

function buildMonteCarlo(
  totals: Totals,
  economics: Economics,
  opts?: { n_trials?: number; target_payback_years?: number }
): NonNullable<SimulationResult['monte_carlo']> {
  const n_trials = opts?.n_trials ?? 2000;
  const target_payback_years = opts?.target_payback_years;
  const paybackSamples: number[] = [];
  const npvSamples: number[] = [];
  const neverPayback = economics.analysis_years + 1;

  for (let i = 0; i < n_trials; i++) {
    const z = normalSample();
    const sampled_E_y = Math.max(0, totals.E_y + totals.SD_y * z);
    const sampledTotals: Totals = { ...totals, E_y: sampled_E_y };
    const fin = computeFinanceFromTotals(sampledTotals, economics);
    paybackSamples.push(fin.payback_years ?? neverPayback);
    npvSamples.push(fin.npv ?? 0);
  }

  const sortedPayback = [...paybackSamples].sort((a, b) => a - b);
  const sortedNpv = [...npvSamples].sort((a, b) => a - b);

  const payback_p10 = percentile(sortedPayback, 0.1);
  const payback_p50 = percentile(sortedPayback, 0.5);
  const payback_p90 = percentile(sortedPayback, 0.9);

  let prob_under_target: number | undefined;
  if (target_payback_years != null) {
    const under = paybackSamples.filter((p) => p <= target_payback_years && p < neverPayback).length;
    prob_under_target = paybackSamples.length > 0 ? under / paybackSamples.length : 0;
  }

  const npv_p10 = percentile(sortedNpv, 0.1);
  const npv_p50 = percentile(sortedNpv, 0.5);
  const npv_p90 = percentile(sortedNpv, 0.9);

  const numBins = 20;
  const histogram_bins = {
    payback: buildHistogram(paybackSamples, numBins),
    npv: buildHistogram(npvSamples, numBins)
  };

  return {
    n_trials,
    target_payback_years,
    payback: { p10: payback_p10, p50: payback_p50, p90: payback_p90, prob_under_target },
    npv: { p10: npv_p10, p50: npv_p50, p90: npv_p90 },
    histogram_bins
  };
}

function buildBreakEven(
  totals: Totals,
  economics: Economics,
  target_payback_years: number = 10
): NonNullable<SimulationResult['break_even']> {
  const fin = computeFinanceFromTotals(totals, economics);
  const T = Math.min(target_payback_years, economics.analysis_years);
  const sumSavingsToT = fin.cashflow_yearly.slice(0, T).reduce((a, b) => a + b, 0);
  const break_even_capex = sumSavingsToT > 0 ? sumSavingsToT : null;

  let break_even_price_buy: number | null = null;
  const basePrice = economics.price_buy;
  let lo = 0.01;
  let hi = Math.max(basePrice * 3, 1);
  const npvAt = (price_buy: number) => {
    const f = computeFinanceFromTotals(totals, { ...economics, price_buy });
    return f.npv ?? -Infinity;
  };
  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const npv = npvAt(mid);
    if (Math.abs(npv) < 1) {
      break_even_price_buy = mid;
      break;
    }
    if (npv < 0) lo = mid;
    else hi = mid;
  }
  if (break_even_price_buy == null && Math.abs(npvAt((lo + hi) / 2)) < 100) {
    break_even_price_buy = (lo + hi) / 2;
  }

  return {
    target_payback_years: T,
    break_even_capex,
    break_even_price_buy
  };
}

function buildKwpOptimization(
  totals: Totals,
  economics: Economics,
  peakpower_kw: number,
  cost_model: { fixed_cost: number; cost_per_kwp: number },
  consumption: { annual_kwh: number; daytime_fraction: number },
  kwp_range?: [number, number, number]
): NonNullable<SimulationResult['kwp_optimization']> {
  const [minKwp, maxKwp, step] = kwp_range ?? [1, 10, 0.5];
  const curve: { kwp: number; npv: number; payback_years: number | null }[] = [];
  const specificYield = peakpower_kw > 0 ? totals.E_y / peakpower_kw : 0;
  let bestNpv = -Infinity;
  let bestNpvKwp = minKwp;
  let bestPayback: number | null = null;
  let bestPaybackKwp = minKwp;

  for (let kwp = minKwp; kwp <= maxKwp + step * 0.5; kwp += step) {
    const E_y = specificYield * kwp;
    const consumptionDaytime = consumption.annual_kwh * consumption.daytime_fraction;
    const self_consumption = E_y > 0 ? Math.min(1, consumptionDaytime / E_y) : 0;
    const capex = cost_model.fixed_cost + cost_model.cost_per_kwp * kwp;
    const modifiedTotals: Totals = { ...totals, E_y };
    const modifiedEconomics: Economics = { ...economics, capex, self_consumption };
    const fin = computeFinanceFromTotals(modifiedTotals, modifiedEconomics);
    curve.push({ kwp, npv: fin.npv ?? 0, payback_years: fin.payback_years });
    if (fin.npv != null && fin.npv > bestNpv) {
      bestNpv = fin.npv;
      bestNpvKwp = kwp;
    }
    if (fin.payback_years != null && (bestPayback == null || fin.payback_years < bestPayback)) {
      bestPayback = fin.payback_years;
      bestPaybackKwp = kwp;
    }
  }

  return {
    recommended_kwp_npv: bestNpvKwp,
    recommended_kwp_payback: bestPaybackKwp,
    curve
  };
}

function buildCharts(
  monthly: MonthlyPoint[],
  capex: number,
  cashflow_cumulative: number[]
): SimulationResult['charts'] {
  const monthly_energy_kwh = monthly.map((m) => ({
    month: m.month,
    kwh: m.E_m
  }));

  const cashflowPoints: { year: number; value: number }[] = [
    { year: 0, value: -capex }
  ];

  cashflow_cumulative.forEach((value, index) => {
    cashflowPoints.push({ year: index + 1, value });
  });

  return {
    monthly_energy_kwh,
    cashflow_cumulative: cashflowPoints
  };
}

function buildInsights(
  pv: SimulateInput['pv'],
  totals: Totals,
  kpis: SimulationResult['kpis'],
  areaType: 'rural' | 'suburban' | 'urban' | null
): SimulationResult['insights'] {
  const insights: SimulationResult['insights'] = [];

  if (areaType === 'urban' || areaType === 'suburban') {
    insights.push({
      type: 'info',
      text: `Yield adjusted for ${areaType} shading (buildings/trees).`,
      key: 'insight.areaTypeShading'
    });
  }

  if (pv.loss_percent > 20) {
    insights.push({
      type: 'warning',
      text: 'High system losses; check inverter sizing, cabling, and shading.',
      key: 'insight.highLosses'
    });
  }

  if (!pv.optimalangles && pv.aspect_deg != null && Math.abs(pv.aspect_deg) > 90) {
    insights.push({
      type: 'warning',
      text: 'Array orientation is far from south; expect reduced energy yield.',
      key: 'insight.orientationFarFromSouth'
    });
  }

  if (totals.E_y > 0 && totals.SD_y / totals.E_y > 0.05) {
    insights.push({
      type: 'info',
      text: 'Year-to-year variability of solar resource is relatively high.',
      key: 'insight.highVariability'
    });
  }

  if (kpis.specific_yield_kwh_per_kwp > 1200) {
    insights.push({
      type: 'info',
      text: 'Great solar resource for PV at this location (high specific yield).',
      key: 'insight.greatSolarResource'
    });
  }

  return insights;
}

