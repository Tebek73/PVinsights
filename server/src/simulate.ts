import { callPVGIS, getHorizonProfile } from './pvgis';
import { getMonthlyArray, num } from './utils';
import type { SimulateInput } from './schema';
import type { ModelWarning } from './preprocess';
import { buildFeasibilityScore, type FeasibilityScorePayload } from './feasibility_score';
import { fetchMonthlyEnergyByCalendarYear, type MonthlyEnergyYearBlock } from './pv_monthly_history';

export type MonthlyPoint = {
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

/** Legacy shape kept for tests / callers expecting the old API surface */
export type FinanceResult = {
  savings_year1: number;
  payback_years: number | null;
  roi: number | null;
  npv: number | null;
  cashflow_yearly: number[];
  cashflow_cumulative: number[];
};

export type FinanceDetailed = {
  savings_year1: number;
  simple_payback_years: number | null;
  discounted_payback_years: number | null;
  roi_lifetime_undiscounted: number | null;
  npv: number | null;
  effective_capex: number;
  lcoe_currency_per_kwh: number | null;
  irr: number | null;
  irr_reason: string | null;
  cashflow_operating_yearly: number[];
  cashflow_net_yearly: number[];
  cashflow_cumulative_nominal: number[];
};

type RNG = () => number;

function mulberry32(seed: number): RNG {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export type HorizonSource = 'pvgis_printhorizon' | 'pvgis_internal' | 'disabled_flat';

export type SimulationResult = {
  model_warnings: ModelWarning[];
  model_assumptions: {
    energy_basis: string;
    cashflow_timing: 'end_of_year';
    capex_timing: 'year_0';
    cashflow_basis: 'nominal';
    discount_rate_basis: 'nominal';
  };
  pvgis: {
    inputs: any;
    raw: { monthly: MonthlyPoint[]; totals: Totals };
    adjusted: { monthly: MonthlyPoint[]; totals: Totals };
    meta: {
      horizon_requested: boolean;
      horizon_source: HorizonSource;
      horizon_warning: string | null;
      near_shading_loss_percent: number;
      near_shading_factor: number;
      near_shading_source: 'explicit_user_input' | 'none';
      adjustments_applied: string[];
    };
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
    simple_payback_years: number | null;
    discounted_payback_years: number | null;
    roi_lifetime_undiscounted: number | null;
    npv: number | null;
    effective_capex: number;
    lcoe_currency_per_kwh: number | null;
    irr: number | null;
    irr_reason: string | null;
    cashflow_operating_yearly: number[];
    cashflow_net_yearly: number[];
    cashflow_cumulative_nominal: number[];
    /** @deprecated use simple_payback_years */
    payback_years: number | null;
    /** @deprecated use roi_lifetime_undiscounted */
    roi: number | null;
    cashflow_yearly: number[];
    cashflow_cumulative: number[];
  };
  charts: {
    monthly_energy_kwh: { month: number; kwh: number }[];
    cashflow_cumulative: { year: number; value: number }[];
    /** Per-calendar-year monthly kWh (PVGIS), adjusted for nearby shading; omitted when disabled or unavailable */
    monthly_energy_by_year?: MonthlyEnergyYearBlock[];
  };
  insights: { type: 'info' | 'warning'; text: string; key?: string }[];
  meta?: { currency?: 'EUR' | 'RON' };
  consumption_analysis?: {
    annual_self_consumed_kwh: number;
    annual_exported_kwh: number;
    self_consumption_ratio: number;
    monthly?: { month: number; pv_kwh: number; self_kwh: number; export_kwh: number }[];
  };
  scenarios?: {
    by_self_consumption: {
      self_consumption: number;
      payback_years: number | null;
      npv: number | null;
      savings_year1: number;
    }[];
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
    /** PVGIS SD_y is year-to-year yield variability from PVGIS, not total model uncertainty */
    yield_uncertainty_basis: string;
    payback: {
      p10: number | null;
      p50: number | null;
      p90: number | null;
      prob_under_target?: number;
    };
    npv: { p10: number | null; p50: number | null; p90: number | null };
    prob_never_payback?: number;
    prob_payback_within_analysis?: number;
    prob_npv_positive?: number;
    valid_samples?: { payback: number; npv: number };
    histogram_bins?: {
      payback: {
        edges: number[];
        counts: number[];
        underflow: number;
        overflow: number;
        total_count: number;
        valid_count: number;
      };
      npv: {
        edges: number[];
        counts: number[];
        underflow: number;
        overflow: number;
        total_count: number;
        valid_count: number;
      };
    };
  };
  break_even?: {
    target_payback_years_simple: number;
    break_even_capex_simple_payback: { value: number | null; reason: string | null };
    break_even_price_buy_npv_zero: { value: number | null; reason: string | null };
  };
  kwp_optimization?: {
    recommended_kwp_npv: number;
    recommended_kwp_payback: number;
    curve: {
      kwp: number;
      annual_kwh: number;
      self_consumption_ratio: number;
      self_consumed_kwh: number;
      exported_kwh: number;
      capex: number;
      npv: number;
      simple_payback_years: number | null;
      discounted_payback_years: number | null;
      lcoe_currency_per_kwh: number | null;
    }[];
  };
  feasibility_score: FeasibilityScorePayload;
};

function cloneMonthly(m: MonthlyPoint[]): MonthlyPoint[] {
  return m.map((x) => ({ ...x }));
}

function cloneTotals(t: Totals): Totals {
  return { ...t };
}

function scaleEnergyMonthly(monthly: MonthlyPoint[], totals: Totals, factor: number): { monthly: MonthlyPoint[]; totals: Totals } {
  return {
    monthly: monthly.map((p) => ({
      ...p,
      E_m: p.E_m * factor,
      SD_m: p.SD_m * factor
    })),
    totals: {
      ...totals,
      E_y: totals.E_y * factor,
      SD_y: totals.SD_y * factor
    }
  };
}

function deriveSelfConsumption(
  monthlyAdjusted: MonthlyPoint[],
  economics: Economics,
  consumption: SimulateInput['consumption'],
  warnings: ModelWarning[]
): {
  ratio: number;
  monthlyRows?: { month: number; pv_kwh: number; self_kwh: number; export_kwh: number }[];
  annual_self_kwh: number;
  annual_export_kwh: number;
} {
  if (!consumption) {
    const Eyear = monthlyAdjusted.reduce((s, m) => s + m.E_m, 0);
    return {
      ratio: economics.self_consumption,
      annual_self_kwh: Eyear * economics.self_consumption,
      annual_export_kwh: Eyear * (1 - economics.self_consumption)
    };
  }

  const annualKwh = consumption.annual_kwh;
  const uniform = 1 / 12;
  let profile = consumption.monthly_load_profile;
  if (profile) {
    const sum = profile.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-5) {
      warnings.push({
        code: 'consumption.monthly_profile_normalized',
        severity: 'warning',
        message: `monthly_load_profile sum was ${sum.toFixed(6)}; normalized to 1 for self-consumption estimate.`
      });
      profile = profile.map((x) => x / sum);
    }
  } else {
    profile = Array(12).fill(uniform);
  }

  let daytimeArr: number[];
  const md = consumption.monthly_daytime_fraction;
  if (md == null) {
    daytimeArr = Array(12).fill(consumption.daytime_fraction);
  } else if (typeof md === 'number') {
    daytimeArr = Array(12).fill(md);
  } else {
    daytimeArr = [...md];
  }

  const monthlyRows: { month: number; pv_kwh: number; self_kwh: number; export_kwh: number }[] = [];
  let annual_self = 0;
  let annual_export = 0;
  let pv_year = 0;

  for (const row of monthlyAdjusted) {
    const m = row.month;
    const idx = m - 1;
    const loadM = annualKwh * profile[idx];
    const dayLoad = loadM * daytimeArr[idx];
    const pvM = row.E_m;
    const selfM = Math.min(pvM, dayLoad);
    const expM = Math.max(0, pvM - selfM);
    monthlyRows.push({ month: m, pv_kwh: pvM, self_kwh: selfM, export_kwh: expM });
    annual_self += selfM;
    annual_export += expM;
    pv_year += pvM;
  }

  const ratio = pv_year > 0 ? annual_self / pv_year : 0;
  warnings.push({
    code: 'consumption.monthly_approximation',
    severity: 'info',
    message:
      'Self-consumption was estimated from monthly load shape and daytime fraction; this is not an hourly PV/load simulation.'
  });

  return { ratio, monthlyRows, annual_self_kwh: annual_self, annual_export_kwh: annual_export };
}

export async function runSimulation(input: SimulateInput, requestWarnings: ModelWarning[] = []): Promise<SimulationResult> {
  const model_warnings: ModelWarning[] = [...requestWarnings];
  const { location, pv, economics: econRaw } = input;

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

  let horizon_source: HorizonSource = pv.usehorizon ? 'pvgis_internal' : 'disabled_flat';
  let horizon_warning: string | null = null;

  if (pv.usehorizon) {
    const horizon = await getHorizonProfile(location.lat, location.lon);
    if (horizon !== null && horizon.length === 48) {
      pvParams.userhorizon = horizon.join(',');
      pvParams.usehorizon = 1;
      horizon_source = 'pvgis_printhorizon';
    } else {
      delete pvParams.userhorizon;
      pvParams.usehorizon = 1;
      horizon_source = 'pvgis_internal';
      horizon_warning =
        'PVGIS printhorizon profile could not be loaded; PVcalc uses PVGIS internal terrain horizon (no custom userhorizon).';
      model_warnings.push({
        code: 'horizon.fallback_internal',
        severity: 'info',
        message: horizon_warning
      });
    }
  } else {
    horizon_warning = null;
  }

  if (pv.usehorizon) {
    model_warnings.push({
      code: 'horizon.terrain_not_near_shading',
      severity: 'info',
      message:
        'PVGIS terrain horizon accounts for distant terrain obstruction, not nearby trees, chimneys, or neighboring buildings.'
    });
  }

  const radiationDatabase =
    pv.raddatabase && pv.raddatabase.trim().length > 0 ? pv.raddatabase : undefined;

  const nearPct = pv.near_shading_loss_percent ?? 0;
  const nearFactor = 1 - nearPct / 100;

  const pvcalc = await callPVGIS('PVcalc', pvParams, radiationDatabase);

  const monthly_history_years = pv.monthly_history_years ?? 0;
  let monthly_energy_by_year: MonthlyEnergyYearBlock[] | undefined;
  if (monthly_history_years > 0) {
    monthly_energy_by_year = await fetchMonthlyEnergyByCalendarYear(
      pvParams,
      radiationDatabase,
      pvcalc,
      monthly_history_years,
      nearFactor,
      model_warnings
    );
    if (monthly_energy_by_year.length === 0 && monthly_history_years > 0) {
      model_warnings.push({
        code: 'charts.monthly_history_unavailable',
        severity: 'info',
        message:
          'Per-calendar-year monthly chart was requested but could not be built (missing meteo year bounds or PVGIS failures). Showing DB-average monthly profile only.'
      });
    }
  }

  const monthlyRaw = parseMonthly(pvcalc);
  const totalsRaw = parseTotals(pvcalc);

  const nearSource: 'explicit_user_input' | 'none' = nearPct > 0 ? 'explicit_user_input' : 'none';

  const scaled = scaleEnergyMonthly(monthlyRaw, totalsRaw, nearFactor);
  const monthlyAdj = scaled.monthly;
  const totalsAdj = scaled.totals;

  const adjustments_applied: string[] = [];
  if (nearPct > 0) {
    adjustments_applied.push(`near_shading_loss_percent=${nearPct}% (user assumption, not geometric shading)`);
    model_warnings.push({
      code: 'near_shading.user_assumption',
      severity: 'warning',
      message:
        'Nearby-object shading loss is a user-provided assumption, not a geometric shading simulation.'
    });
  }

  const derived = deriveSelfConsumption(monthlyAdj, econRaw, input.consumption, model_warnings);
  const economics: Economics = input.consumption
    ? { ...econRaw, self_consumption: derived.ratio }
    : econRaw;

  const kpis = computeKpis(totalsAdj, monthlyAdj, pv.peakpower_kw);
  const financeDetailed = computeFinanceDetailed(totalsAdj, economics);
  const financeBlock = buildFinanceResponseBlock(financeDetailed);
  const charts = buildCharts(
    monthlyAdj,
    financeDetailed.effective_capex,
    financeDetailed.cashflow_cumulative_nominal,
    monthly_energy_by_year
  );
  const insights = buildInsights(pv, totalsAdj, kpis, nearPct);
  const scenarios = buildScenarios(totalsAdj, economics);
  const sensitivity = buildSensitivity(totalsAdj, economics);
  const monte_carlo =
    input.monte_carlo != null ? buildMonteCarlo(totalsAdj, economics, input.monte_carlo) : undefined;
  const break_even = buildBreakEvenRobust(totalsAdj, economics);
  const kwp_optimization =
    input.cost_model && input.consumption
      ? buildKwpOptimization(
          totalsAdj,
          monthlyAdj,
          economics,
          pv.peakpower_kw,
          input.cost_model,
          input.consumption,
          input.kwp_range,
          input.kwp_constraints,
          model_warnings
        )
      : undefined;

  const consumption_analysis =
    input.consumption && derived.monthlyRows
      ? {
          annual_self_consumed_kwh: derived.annual_self_kwh,
          annual_exported_kwh: derived.annual_export_kwh,
          self_consumption_ratio: derived.ratio,
          monthly: derived.monthlyRows
        }
      : input.consumption
        ? {
            annual_self_consumed_kwh: derived.annual_self_kwh,
            annual_exported_kwh: derived.annual_export_kwh,
            self_consumption_ratio: derived.ratio
          }
        : undefined;

  const feasibility_score = buildFeasibilityScore(
    kpis,
    {
      npv: financeBlock.npv,
      effective_capex: financeBlock.effective_capex,
      simple_payback_years: financeBlock.simple_payback_years,
      payback_years: financeBlock.payback_years,
      irr: financeBlock.irr
    },
    { analysis_years: economics.analysis_years, discount_rate: economics.discount_rate },
    monte_carlo,
    input.monte_carlo != null
  );

  return {
    model_warnings,
    model_assumptions: {
      energy_basis:
        'PVGIS raw yield; adjusted only by explicit user nearby-shading loss (if any). KPIs and finance use adjusted energy.',
      cashflow_timing: 'end_of_year',
      capex_timing: 'year_0',
      cashflow_basis: 'nominal',
      discount_rate_basis: 'nominal'
    },
    pvgis: {
      inputs: pvcalc?.inputs ?? null,
      raw: { monthly: cloneMonthly(monthlyRaw), totals: cloneTotals(totalsRaw) },
      adjusted: { monthly: cloneMonthly(monthlyAdj), totals: cloneTotals(totalsAdj) },
      meta: {
        horizon_requested: pv.usehorizon,
        horizon_source,
        horizon_warning,
        near_shading_loss_percent: nearPct,
        near_shading_factor: nearFactor,
        near_shading_source: nearSource,
        adjustments_applied
      }
    },
    kpis,
    finance: financeBlock,
    charts,
    insights,
    meta: { currency: economics.currency },
    consumption_analysis,
    scenarios,
    sensitivity,
    monte_carlo,
    break_even,
    kwp_optimization,
    feasibility_score
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
    best_month && worst_month && worst_month.kwh > 0 ? best_month.kwh / worst_month.kwh : null;

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

function replacementTotalNominal(events: Economics['replacement_events']): number {
  if (!events?.length) return 0;
  return events.reduce((s, e) => s + e.cost, 0);
}

export function computeFinanceDetailed(totals: Totals, economics: Economics): FinanceDetailed {
  const subsidyAmt = economics.subsidy_amount ?? 0;
  const subsidyPct = economics.subsidy_percent_capex ?? 0;
  const effective_capex = Math.max(0, economics.capex - subsidyAmt - economics.capex * subsidyPct);

  const E1 = totals.E_y;
  const N = economics.analysis_years;
  const d = economics.degradation;
  const gBuy = economics.price_escalation;
  const gSell = economics.price_sell_escalation ?? 0;
  const gOpex = economics.opex_escalation ?? 0;
  const r = economics.discount_rate;

  const replacementByYear = new Map<number, number>();
  for (const ev of economics.replacement_events ?? []) {
    const y = Math.min(Math.max(1, Math.floor(ev.year)), N);
    replacementByYear.set(y, (replacementByYear.get(y) ?? 0) + ev.cost);
  }

  const operating: number[] = [];
  const net: number[] = [];
  const cumulativeNom: number[] = [];

  let cumNom = -effective_capex;
  let simplePayback: number | null = null;

  let cumDisc = -effective_capex;
  let discPayback: number | null = null;

  let npvSum = -effective_capex;

  let pvCostNumerator = effective_capex;
  let pvEnergyDenominator = 0;

  let sumNetUndiscounted = 0;

  for (let t = 1; t <= N; t++) {
    const E_t = E1 * Math.pow(1 - d, t - 1);
    const price_buy_t = economics.price_buy * Math.pow(1 + gBuy, t - 1);
    const price_sell_t = economics.price_sell * Math.pow(1 + gSell, t - 1);
    const opex_t = economics.opex_yearly * Math.pow(1 + gOpex, t - 1);

    const E_self = E_t * economics.self_consumption;
    const E_export = E_t - E_self;

    const op = E_self * price_buy_t + E_export * price_sell_t - opex_t;
    const rep = replacementByYear.get(t) ?? 0;
    const nt = op - rep;

    operating.push(op);
    net.push(nt);
    sumNetUndiscounted += nt;

    const cumPrev = cumNom;
    cumNom += nt;
    cumulativeNom.push(cumNom);

    if (simplePayback === null && cumNom >= 0) {
      const denom = Math.abs(nt) > 1e-9 ? nt : null;
      if (denom) {
        const frac = Math.min(1, Math.max(0, (0 - cumPrev) / denom));
        simplePayback = t - 1 + frac;
      } else {
        simplePayback = t;
      }
    }

    const discFactor = r > 0 ? Math.pow(1 + r, t) : 1;
    const discNt = r > 0 ? nt / discFactor : nt;
    const pvOpex = r > 0 ? opex_t / discFactor : opex_t;
    const pvRep = r > 0 ? rep / discFactor : rep;

    pvCostNumerator += pvOpex + pvRep;
    pvEnergyDenominator += r > 0 ? E_t / discFactor : E_t;

    const cumDiscPrev = cumDisc;
    cumDisc += discNt;

    if (discPayback === null && cumDisc >= 0) {
      const denom = Math.abs(discNt) > 1e-12 ? discNt : null;
      if (denom) {
        const frac = Math.min(1, Math.max(0, (0 - cumDiscPrev) / denom));
        discPayback = t - 1 + frac;
      } else {
        discPayback = t;
      }
    }

    npvSum += r > 0 ? nt / discFactor : nt;
  }

  const roi_lifetime_undiscounted =
    effective_capex > 0 ? (sumNetUndiscounted - effective_capex) / effective_capex : null;

  const lcoe_currency_per_kwh =
    pvEnergyDenominator > 1e-12 ? pvCostNumerator / pvEnergyDenominator : null;

  const flows = [-effective_capex, ...net];
  const { irr, irr_reason } = solveIrr(flows);

  return {
    savings_year1: operating[0] ?? 0,
    simple_payback_years: simplePayback,
    discounted_payback_years: discPayback,
    roi_lifetime_undiscounted,
    npv: npvSum,
    effective_capex,
    lcoe_currency_per_kwh,
    irr,
    irr_reason,
    cashflow_operating_yearly: operating,
    cashflow_net_yearly: net,
    cashflow_cumulative_nominal: cumulativeNom
  };
}

function buildFinanceResponseBlock(d: FinanceDetailed): SimulationResult['finance'] {
  return {
    savings_year1: d.savings_year1,
    simple_payback_years: d.simple_payback_years,
    discounted_payback_years: d.discounted_payback_years,
    roi_lifetime_undiscounted: d.roi_lifetime_undiscounted,
    npv: d.npv,
    effective_capex: d.effective_capex,
    lcoe_currency_per_kwh: d.lcoe_currency_per_kwh,
    irr: d.irr,
    irr_reason: d.irr_reason,
    cashflow_operating_yearly: d.cashflow_operating_yearly,
    cashflow_net_yearly: d.cashflow_net_yearly,
    cashflow_cumulative_nominal: d.cashflow_cumulative_nominal,
    payback_years: d.simple_payback_years,
    roi: d.roi_lifetime_undiscounted,
    cashflow_yearly: d.cashflow_net_yearly,
    cashflow_cumulative: d.cashflow_cumulative_nominal
  };
}

function npvAtRate(flows: number[], rate: number): number {
  let s = 0;
  for (let t = 0; t < flows.length; t++) {
    s += flows[t] / Math.pow(1 + rate, t);
  }
  return s;
}

function solveIrr(flows: number[]): { irr: number | null; irr_reason: string | null } {
  if (flows.length < 2) return { irr: null, irr_reason: 'not_enough_cashflows' };
  const neg = flows.some((x) => x < -1e-12);
  const pos = flows.some((x) => x > 1e-12);
  if (!neg || !pos) {
    return { irr: null, irr_reason: 'no_sign_change_in_cashflows' };
  }
  const lo = -0.9999;
  const hi = 10;
  let fLo = npvAtRate(flows, lo);
  let fHi = npvAtRate(flows, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { irr: null, irr_reason: 'non_finite_npv' };
  }
  let expanded = 0;
  while (fLo * fHi > 0 && expanded < 30) {
    const hi2 = hi * 1.5 + 0.5;
    const fHi2 = npvAtRate(flows, hi2);
    if (!Number.isFinite(fHi2)) break;
    fHi = fHi2;
    expanded++;
  }
  if (fLo * fHi > 0) {
    return { irr: null, irr_reason: 'could_not_bracket_root' };
  }
  let a = lo;
  let b = hi;
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2;
    const fm = npvAtRate(flows, mid);
    if (Math.abs(fm) < 1e-8) return { irr: mid, irr_reason: null };
    if (npvAtRate(flows, a) * fm <= 0) b = mid;
    else a = mid;
  }
  return { irr: (a + b) / 2, irr_reason: null };
}

/** Legacy export for tests */
export function computeFinanceFromTotals(totals: Totals, economics: Economics): FinanceResult {
  const d = computeFinanceDetailed(totals, economics);
  return {
    savings_year1: d.savings_year1,
    payback_years: d.simple_payback_years,
    roi: d.roi_lifetime_undiscounted,
    npv: d.npv,
    cashflow_yearly: d.cashflow_net_yearly,
    cashflow_cumulative: d.cashflow_cumulative_nominal
  };
}

function buildScenarios(
  totals: Totals,
  economics: Economics
): NonNullable<SimulationResult['scenarios']> {
  const by_self_consumption = [0.3, 0.5, 0.7].map((self_consumption) => {
    const fin = computeFinanceDetailed(totals, { ...economics, self_consumption });
    return {
      self_consumption,
      payback_years: fin.simple_payback_years,
      npv: fin.npv,
      savings_year1: fin.savings_year1
    };
  });
  const basePrice = economics.price_buy;
  const by_price_buy = [basePrice * 0.8, basePrice, basePrice * 1.2].map((price_buy) => {
    const fin = computeFinanceDetailed(totals, { ...economics, price_buy });
    return {
      price_buy,
      payback_years: fin.simple_payback_years,
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
    const fin = computeFinanceDetailed(totals, { ...economics, price_buy });
    payback1D.push(fin.simple_payback_years);
    npv1D.push(fin.npv);
  }
  const one_d = {
    variable: 'price_buy' as const,
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
      const fin = computeFinanceDetailed(totals, {
        ...economics,
        price_buy: xAxis[i],
        self_consumption: yAxis[j]
      });
      paybackGrid[i].push(fin.simple_payback_years);
      npvGrid[i].push(fin.npv);
    }
  }
  const two_d = {
    variable_x: 'price_buy' as const,
    variable_y: 'self_consumption' as const,
    x_axis: xAxis,
    y_axis: yAxis,
    payback_grid: paybackGrid,
    npv_grid: npvGrid
  };
  return { one_d, two_d };
}

function normalSample(rng: RNG): number {
  let u1 = rng();
  const u2 = rng();
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

function percentileOrNull(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return percentile(sorted, p);
}

function buildClippedHistogram(
  values: number[],
  numBins: number,
  clipLo: number = 0.01,
  clipHi: number = 0.99
): {
  edges: number[];
  counts: number[];
  underflow: number;
  overflow: number;
  total_count: number;
  valid_count: number;
} {
  const total_count = values.length;
  if (values.length === 0) {
    return { edges: [], counts: [], underflow: 0, overflow: 0, total_count: 0, valid_count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const loVal = percentile(sorted, clipLo);
  const hiVal = percentile(sorted, clipHi);
  const min = Math.min(loVal, hiVal);
  const max = Math.max(loVal, hiVal);
  let underflow = 0;
  let overflow = 0;
  const clipped: number[] = [];
  for (const v of values) {
    if (v < min) underflow++;
    else if (v > max) overflow++;
    else clipped.push(v);
  }
  const valid_count = values.length;
  if (clipped.length === 0 || min === max) {
    return { edges: [min, max], counts: [clipped.length], underflow, overflow, total_count, valid_count };
  }
  const range = max - min;
  const counts = new Array(numBins).fill(0);
  for (const v of clipped) {
    const bin = Math.min(Math.floor(((v - min) / range) * numBins), numBins - 1);
    counts[bin]++;
  }
  const edges: number[] = [];
  for (let i = 0; i <= numBins; i++) edges.push(min + (range * i) / numBins);
  return { edges, counts, underflow, overflow, total_count, valid_count };
}

function buildMonteCarlo(
  totals: Totals,
  economics: Economics,
  opts?: {
    n_trials?: number;
    target_payback_years?: number;
    seed?: number;
    uncertainty?: {
      capex_rel_std?: number;
      self_consumption_abs_std?: number;
      degradation_abs_std?: number;
      price_escalation_abs_std?: number;
      discount_rate_abs_std?: number;
      pv_yield_use_sd_y?: boolean;
      model_yield_uncertainty_rel_std?: number;
    };
  }
): NonNullable<SimulationResult['monte_carlo']> {
  const n_trials = opts?.n_trials ?? 2000;
  const target_payback_years = opts?.target_payback_years;

  const u = opts?.uncertainty ?? {};
  const defaults = {
    pv_yield_use_sd_y: u.pv_yield_use_sd_y ?? true,
    capex_rel_std: u.capex_rel_std ?? 0.1,
    self_consumption_abs_std: u.self_consumption_abs_std ?? 0.05,
    degradation_abs_std: u.degradation_abs_std ?? 0.002,
    price_escalation_abs_std: u.price_escalation_abs_std ?? 0.02,
    discount_rate_abs_std: u.discount_rate_abs_std ?? 0,
    model_yield_uncertainty_rel_std: u.model_yield_uncertainty_rel_std ?? 0
  };

  const rng: RNG = opts?.seed != null ? mulberry32(opts.seed) : Math.random;

  const paybackSamples: (number | null)[] = [];
  const npvSamples: (number | null)[] = [];

  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

  for (let i = 0; i < n_trials; i++) {
    const zYield = normalSample(rng);
    let sampled_E_y = defaults.pv_yield_use_sd_y
      ? Math.max(0, totals.E_y + totals.SD_y * zYield)
      : totals.E_y;
    if (defaults.model_yield_uncertainty_rel_std > 0) {
      const z2 = normalSample(rng);
      sampled_E_y = Math.max(0, sampled_E_y * (1 + defaults.model_yield_uncertainty_rel_std * z2));
    }

    const sampledTotals: Totals = { ...totals, E_y: sampled_E_y };

    const zCapex = normalSample(rng);
    const zSelf = normalSample(rng);
    const zDeg = normalSample(rng);
    const zEsc = normalSample(rng);
    const zDisc = normalSample(rng);

    const sampledEconomics: Economics = {
      ...economics,
      capex: Math.max(1e-6, economics.capex * (1 + defaults.capex_rel_std * zCapex)),
      self_consumption: clamp01(economics.self_consumption + defaults.self_consumption_abs_std * zSelf),
      degradation: clamp(economics.degradation + defaults.degradation_abs_std * zDeg, 0, 0.1),
      price_escalation: clamp(economics.price_escalation + defaults.price_escalation_abs_std * zEsc, 0, 1),
      discount_rate: clamp(economics.discount_rate + defaults.discount_rate_abs_std * zDisc, 0, 1)
    };

    const fin = computeFinanceDetailed(sampledTotals, sampledEconomics);
    paybackSamples.push(fin.simple_payback_years);
    npvSamples.push(fin.npv);
  }

  const validPaybacks = paybackSamples.filter((p): p is number => p != null && Number.isFinite(p));
  const validNpvs = npvSamples.filter((v): v is number => v != null && Number.isFinite(v));

  const prob_never_payback = n_trials > 0 ? (n_trials - validPaybacks.length) / n_trials : 0;
  const prob_payback_within_analysis = n_trials > 0 ? validPaybacks.length / n_trials : 0;
  const prob_npv_positive = validNpvs.length > 0 ? validNpvs.filter((v) => v > 0).length / validNpvs.length : 0;

  const sortedPayback = [...validPaybacks].sort((a, b) => a - b);
  const sortedNpv = [...validNpvs].sort((a, b) => a - b);

  const payback_p10 = percentileOrNull(sortedPayback, 0.1);
  const payback_p50 = percentileOrNull(sortedPayback, 0.5);
  const payback_p90 = percentileOrNull(sortedPayback, 0.9);

  let prob_under_target: number | undefined;
  if (target_payback_years != null) {
    const under = validPaybacks.filter((p) => p <= target_payback_years).length;
    prob_under_target = n_trials > 0 ? under / n_trials : 0;
  }

  const npv_p10 = percentileOrNull(sortedNpv, 0.1);
  const npv_p50 = percentileOrNull(sortedNpv, 0.5);
  const npv_p90 = percentileOrNull(sortedNpv, 0.9);

  const numBins = 20;
  const histogram_bins = {
    payback: buildClippedHistogram(validPaybacks, numBins),
    npv: buildClippedHistogram(validNpvs, numBins)
  };

  return {
    n_trials,
    target_payback_years,
    yield_uncertainty_basis:
      'Monte Carlo uses PVGIS SD_y as a proxy for year-to-year yield variability, optionally plus optional relative model jitter. It is not total project uncertainty.',
    payback: { p10: payback_p10, p50: payback_p50, p90: payback_p90, prob_under_target },
    npv: { p10: npv_p10, p50: npv_p50, p90: npv_p90 },
    prob_never_payback,
    prob_payback_within_analysis,
    prob_npv_positive,
    valid_samples: { payback: validPaybacks.length, npv: validNpvs.length },
    histogram_bins
  };
}

function buildBreakEvenRobust(
  totals: Totals,
  economics: Economics,
  target_payback_years: number = 10
): NonNullable<SimulationResult['break_even']> {
  const fin = computeFinanceDetailed(totals, economics);
  const T = Math.min(target_payback_years, economics.analysis_years);
  const sumSavingsToT = fin.cashflow_operating_yearly.slice(0, T).reduce((a, b) => a + b, 0);

  let capexReason: string | null = null;
  let break_even_capex: number | null = null;
  if (sumSavingsToT <= 0) {
    capexReason = 'undiscounted_operating_cashflow_non_positive_over_target_horizon';
  } else {
    break_even_capex = sumSavingsToT;
  }

  const s = economics.self_consumption;
  const ps = economics.price_sell;
  if (s <= 1e-12 && ps <= 1e-12) {
    return {
      target_payback_years_simple: T,
      break_even_capex_simple_payback: { value: break_even_capex, reason: capexReason },
      break_even_price_buy_npv_zero: {
        value: null,
        reason: 'price_buy_does_not_affect_revenue_when_self_consumption_and_export_price_are_zero'
      }
    };
  }

  const npvAt = (price_buy: number) => computeFinanceDetailed(totals, { ...economics, price_buy }).npv ?? -Infinity;

  let lo = 1e-6;
  let hi = Math.max(economics.price_buy * 10, 1);
  let nLo = npvAt(lo);
  let nHi = npvAt(hi);
  let expansions = 0;
  while (nLo * nHi > 0 && expansions < 40) {
    hi *= 2;
    nHi = npvAt(hi);
    expansions++;
  }

  let priceReason: string | null = null;
  let break_even_price: number | null = null;

  if (!Number.isFinite(nLo) || !Number.isFinite(nHi) || nLo * nHi > 0) {
    priceReason = 'npv_did_not_change_sign_over_bracketed_price_buy_range';
  } else {
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2;
      const npv = npvAt(mid);
      if (Math.abs(npv) < 1e-3) {
        break_even_price = mid;
        break;
      }
      if (npv < 0) lo = mid;
      else hi = mid;
    }
    if (break_even_price == null) {
      break_even_price = (lo + hi) / 2;
    }
  }

  return {
    target_payback_years_simple: T,
    break_even_capex_simple_payback: { value: break_even_capex, reason: capexReason },
    break_even_price_buy_npv_zero: { value: break_even_price, reason: priceReason }
  };
}

function scaleMonthlyToMatchAnnual(monthlyBase: MonthlyPoint[], E_y_target: number): MonthlyPoint[] {
  const sumEm = monthlyBase.reduce((s, m) => s + m.E_m, 0);
  const scale = sumEm > 1e-12 ? E_y_target / sumEm : 0;
  return monthlyBase.map((m) => ({
    ...m,
    E_m: m.E_m * scale,
    SD_m: m.SD_m * scale
  }));
}

function buildKwpOptimization(
  totals: Totals,
  monthlyBase: MonthlyPoint[],
  economics: Economics,
  peakpower_kw: number,
  cost_model: { fixed_cost: number; cost_per_kwp: number },
  consumption: SimulateInput['consumption'],
  kwp_range?: [number, number, number],
  kwp_constraints?: SimulateInput['kwp_constraints'],
  warnings: ModelWarning[] = []
): NonNullable<SimulationResult['kwp_optimization']> {
  if (!consumption) {
    warnings.push({
      code: 'kwp.missing_consumption',
      severity: 'warning',
      message: 'kWp optimization requires consumption inputs.'
    });
    return { recommended_kwp_npv: 0, recommended_kwp_payback: 0, curve: [] };
  }

  let [minKwp, maxKwp, step] = kwp_range ?? [1, 10, 0.5];

  if (kwp_constraints?.max_kwp != null) {
    maxKwp = Math.min(maxKwp, kwp_constraints.max_kwp);
  }
  if (
    kwp_constraints?.max_roof_area_m2 != null &&
    kwp_constraints?.panel_area_m2 != null &&
    kwp_constraints?.panel_power_wp != null
  ) {
    const maxPanels = Math.floor(kwp_constraints.max_roof_area_m2 / kwp_constraints.panel_area_m2);
    const maxFromRoof = (maxPanels * kwp_constraints.panel_power_wp) / 1000;
    maxKwp = Math.min(maxKwp, maxFromRoof);
  }

  if (maxKwp < minKwp) {
    warnings.push({
      code: 'kwp.infeasible_range',
      severity: 'warning',
      message: 'kWp search range empty after applying constraints.'
    });
    return { recommended_kwp_npv: minKwp, recommended_kwp_payback: minKwp, curve: [] };
  }

  const specificYield = peakpower_kw > 0 ? totals.E_y / peakpower_kw : 0;

  const curve: NonNullable<SimulationResult['kwp_optimization']>['curve'] = [];
  let bestNpv = -Infinity;
  let bestNpvKwp = minKwp;
  let bestPayback: number | null = null;
  let bestPaybackKwp = minKwp;

  const template =
    monthlyBase.length >= 12
      ? cloneMonthly(monthlyBase)
      : Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          E_m: totals.E_y / 12,
          SD_m: totals.SD_y / 12,
          H_i_m: 0
        }));

  for (let kwp = minKwp; kwp <= maxKwp + step * 0.5; kwp += step) {
    const E_y = specificYield * kwp;
    const monthlyK = scaleMonthlyToMatchAnnual(template, E_y);
    const derivedK = deriveSelfConsumption(monthlyK, economics, consumption, []);
    const capex = cost_model.fixed_cost + cost_model.cost_per_kwp * kwp;
    const modifiedTotals: Totals = { ...totals, E_y };
    const modifiedEconomics: Economics = { ...economics, capex, self_consumption: derivedK.ratio };
    const fin = computeFinanceDetailed(modifiedTotals, modifiedEconomics);
    curve.push({
      kwp,
      annual_kwh: E_y,
      self_consumption_ratio: derivedK.ratio,
      self_consumed_kwh: derivedK.annual_self_kwh,
      exported_kwh: derivedK.annual_export_kwh,
      capex,
      npv: fin.npv ?? 0,
      simple_payback_years: fin.simple_payback_years,
      discounted_payback_years: fin.discounted_payback_years,
      lcoe_currency_per_kwh: fin.lcoe_currency_per_kwh
    });
    if (fin.npv != null && fin.npv > bestNpv) {
      bestNpv = fin.npv;
      bestNpvKwp = kwp;
    }
    if (fin.simple_payback_years != null && (bestPayback == null || fin.simple_payback_years < bestPayback)) {
      bestPayback = fin.simple_payback_years;
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
  effective_capex: number,
  cashflow_cumulative_nominal: number[],
  monthly_energy_by_year?: MonthlyEnergyYearBlock[]
): SimulationResult['charts'] {
  const monthly_energy_kwh = monthly.map((m) => ({
    month: m.month,
    kwh: m.E_m
  }));

  const cashflowPoints: { year: number; value: number }[] = [{ year: 0, value: -effective_capex }];

  cashflow_cumulative_nominal.forEach((value, index) => {
    cashflowPoints.push({ year: index + 1, value });
  });

  const out: SimulationResult['charts'] = {
    monthly_energy_kwh,
    cashflow_cumulative: cashflowPoints
  };
  if (monthly_energy_by_year && monthly_energy_by_year.length > 0) {
    out.monthly_energy_by_year = monthly_energy_by_year;
  }
  return out;
}

function buildInsights(
  pv: SimulateInput['pv'],
  totals: Totals,
  kpis: SimulationResult['kpis'],
  nearShadingPct: number
): SimulationResult['insights'] {
  const insights: SimulationResult['insights'] = [];

  if (nearShadingPct > 0) {
    insights.push({
      type: 'warning',
      key: 'insight.nearShadingAssumption',
      text: `Nearby-object shading loss set to ${nearShadingPct}% (user assumption).`
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
      text: 'Year-to-year variability of solar resource is relatively high at this location.',
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
